﻿import { queryWithTenant, transaction, connExecute } from "../shared/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ==================== 数据库行接口定义 ====================

/** 调拨单 + 门店名称联表行 — t_transfer_order SELECT * + 关联门店名称 */
interface TransferOrderWithStoreRow {
  id: number;
  transfer_no: string;
  from_store_id: number;
  to_store_id: number;
  transfer_status: string;
  status: string;
  expected_date: string | Date | null;
  total_amount: number | string;
  total_items: number;
  created_by: number | null;
  approved_by: number | null;
  approved_at: string | Date | null;
  shipped_by: number | null;
  shipped_at: string | Date | null;
  received_by: number | null;
  received_at: string | Date | null;
  actual_date: string | Date | null;
  goods_amount: number | string;
  operator_id: number | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  from_store_name: string | null;
  to_store_name: string | null;
}

/** 调拨单行（事务内 SELECT *） — t_transfer_order */
interface TransferOrderRow extends RowDataPacket {
  id: number;
  transfer_no: string;
  from_store_id: number;
  to_store_id: number;
  status: string;
  expected_date: string | Date | null;
  total_amount: number | string;
  total_items: number;
  remark: string | null;
  created_by: number | null;
  approved_by: number | null;
  approved_at: string | Date | null;
  shipped_by: number | null;
  shipped_at: string | Date | null;
  received_by: number | null;
  received_at: string | Date | null;
  actual_date: string | Date | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 调拨单明细行 — t_transfer_order_item SELECT * */
interface TransferOrderItemRow extends RowDataPacket {
  id: number;
  transfer_order_id: number;
  sku_id: number;
  sku_name: string;
  quantity: number | string;
  unit_price: number | string;
  subtotal: number | string;
  transferred_qty: number | string;
  received_qty: number | string;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 库存余额行 — t_inventory_balance SELECT * */
interface InventoryBalanceRow extends RowDataPacket {
  id: number;
  store_id: number;
  sku_id: number;
  sku_name: string | null;
  physical_qty: number | string;
  locked_qty: number | string;
  available_qty: number | string;
  stock_type: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 调拨单明细收货检查行 — SELECT received_qty, quantity */
interface TransferOrderItemCheckRow extends RowDataPacket {
  received_qty: number | string;
  quantity: number | string;
}

export async function cancelTransferOrder(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await connExecute<TransferOrderRow[]>(
      conn,
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = rows[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT" && order.status !== "PENDING") {
      throw new Error("仅草稿或待审核状态可取消");
    }

    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_transfer_order SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { transferOrderId: id };
}

export async function shipTransferOrder(id: number, tenantId: string, userId: number | null) {
  await transaction(async (conn) => {
    const [rows] = await connExecute<TransferOrderRow[]>(
      conn,
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = rows[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "APPROVED") throw new Error("仅已审核状态可发货");

    const [itemRows] = await connExecute<TransferOrderItemRow[]>(
      conn,
      "SELECT * FROM t_transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const items = itemRows;

    for (const item of items) {
      const shipQty = Number(item.quantity) - Number(item.transferred_qty);
      if (shipQty <= 0) continue;

      const [invRows] = await connExecute<InventoryBalanceRow[]>(
        conn,
        "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.from_store_id, item.sku_id, tenantId]
      );
      const inv = invRows[0];
      if (!inv || Number(inv.available_qty) < shipQty) {
        throw new Error(`SKU ${item.sku_name} 库存不足，可用 ${inv?.available_qty ?? 0}，需要 ${shipQty}`);
      }

      await connExecute<ResultSetHeader>(
        conn,
        "UPDATE t_inventory_balance SET available_qty = available_qty - ?, locked_qty = locked_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [shipQty, shipQty, order.from_store_id, item.sku_id, tenantId]
      );

      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_OUT', ?, available_qty, available_qty - ?, ?, ?, NOW(), ?
         FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.from_store_id, item.sku_id, item.sku_name, shipQty, shipQty, order.transfer_no, userId ?? null, tenantId, order.from_store_id, item.sku_id, tenantId]
      );

      await connExecute<ResultSetHeader>(
        conn,
        "UPDATE t_transfer_order_item SET transferred_qty = transferred_qty + ? WHERE id = ? AND tenant_id = ?",
        [shipQty, item.id, tenantId]
      );

      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'OUT', ?, ?, ?)`,
        [id, item.id, order.from_store_id, item.sku_id, shipQty, userId ?? null, tenantId]
      );
    }

    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_transfer_order SET status = 'TRANSIT' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { transferOrderId: id };
}

export interface ReceiveItem {
  itemId: number;
  receivedQty: number;
}

export async function receiveTransferOrder(id: number, tenantId: string, userId: number | null, items: ReceiveItem[]) {
  await transaction(async (conn) => {
    const [rows] = await connExecute<TransferOrderRow[]>(
      conn,
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = rows[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "TRANSIT") throw new Error("仅在途状态可收货");

    let allReceived = true;

    for (const item of items) {
      const [itemRows] = await connExecute<TransferOrderItemRow[]>(
        conn,
        "SELECT * FROM t_transfer_order_item WHERE id = ? AND transfer_order_id = ? AND tenant_id = ? FOR UPDATE",
        [item.itemId, id, tenantId]
      );
      const detail = itemRows[0];
      if (!detail) throw new Error("明细不存在");

      const remaining = Number(detail.quantity) - Number(detail.received_qty);
      if (item.receivedQty > remaining) {
        throw new Error(`SKU ${detail.sku_name} 收货数量超出待收数量(剩余 ${remaining})`);
      }

      const [invRows] = await connExecute<InventoryBalanceRow[]>(
        conn,
        "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.to_store_id, detail.sku_id, tenantId]
      );
      const inv = invRows[0];

      if (inv) {
        await connExecute<ResultSetHeader>(
          conn,
          "UPDATE t_inventory_balance SET available_qty = available_qty + ?, locked_qty = GREATEST(locked_qty - ?, 0) WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
          [item.receivedQty, item.receivedQty, order.to_store_id, detail.sku_id, tenantId]
        );
      } else {
        await connExecute<ResultSetHeader>(
          conn,
          `INSERT INTO t_inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, tenantId]
        );
      }

      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_IN', ?, available_qty - ?, available_qty, ?, ?, NOW(), ?
         FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, item.receivedQty, order.transfer_no, userId ?? null, tenantId, order.to_store_id, detail.sku_id, tenantId]
      );

      await connExecute<ResultSetHeader>(
        conn,
        "UPDATE t_transfer_order_item SET received_qty = received_qty + ? WHERE id = ? AND tenant_id = ?",
        [item.receivedQty, item.itemId, tenantId]
      );

      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'IN', ?, ?, ?)`,
        [id, item.itemId, order.to_store_id, detail.sku_id, item.receivedQty, userId ?? null, tenantId]
      );

      const [checkRows] = await connExecute<TransferOrderItemCheckRow[]>(
        conn,
        "SELECT received_qty, quantity FROM t_transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
        [id, tenantId]
      );
      for (const row of checkRows) {
        if (Number(row.received_qty) < Number(row.quantity)) {
          allReceived = false;
          break;
        }
      }
    }

    if (allReceived) {
      await connExecute<ResultSetHeader>(
        conn,
        "UPDATE t_transfer_order SET status = 'RECEIVED', actual_date = CURDATE(), received_by = ?, received_at = NOW() WHERE id = ? AND tenant_id = ?",
        [userId ?? null, id, tenantId]
      );
    }
  });

  return { transferOrderId: id };
}

export async function getInTransitOrders(storeId: number, tenantId: string) {
  const records = await queryWithTenant<TransferOrderWithStoreRow>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM t_transfer_order to
     LEFT JOIN t_store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN t_store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.to_store_id = ? AND to.status IN ('APPROVED', 'TRANSIT')
     ORDER BY to.created_at DESC`,
    [storeId],
    tenantId
  );

  return records;
}

export async function getMyShipments(storeId: number, tenantId: string) {
  const records = await queryWithTenant<TransferOrderWithStoreRow>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM t_transfer_order to
     LEFT JOIN t_store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN t_store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.from_store_id = ? AND to.status IN ('TRANSIT', 'RECEIVED')
     ORDER BY to.created_at DESC`,
    [storeId],
    tenantId
  );

  return records;
}
