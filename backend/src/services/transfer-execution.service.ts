import { queryWithTenant, transaction } from "../shared/db";

export async function cancelTransferOrder(id: number, tenantId: string) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as unknown as Record<string, unknown>[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT" && order.status !== "PENDING") {
      throw new Error("仅草稿或待审核状态可取消");
    }

    await (conn as any).execute(
      "UPDATE t_transfer_order SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { transferOrderId: id };
}

export async function shipTransferOrder(id: number, tenantId: string, userId: number | null) {
  await transaction(async (conn) => {
    const [rows] = await (conn as any).execute(
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as unknown as Record<string, unknown>[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "APPROVED") throw new Error("仅已审核状态可发货");

    const [itemRows] = await (conn as any).execute(
      "SELECT * FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const items = itemRows as unknown as Record<string, unknown>[];

    for (const item of items) {
      const shipQty = Number(item.quantity) - Number(item.transferred_qty);
      if (shipQty <= 0) continue;

      const [invRows] = await (conn as any).execute(
        "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.from_store_id, item.sku_id, tenantId]
      );
      const inv = (invRows as unknown as Record<string, unknown>[])[0];
      if (!inv || Number(inv.available_qty) < shipQty) {
        throw new Error(`SKU ${item.sku_name} 库存不足，可用 ${inv?.available_qty ?? 0}，需要 ${shipQty}`);
      }

      await (conn as any).execute(
        "UPDATE t_inventory_balance SET available_qty = available_qty - ?, locked_qty = locked_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [shipQty, shipQty, order.from_store_id, item.sku_id, tenantId]
      );

      await (conn as any).execute(
        `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_OUT', ?, available_qty, available_qty - ?, ?, ?, NOW(), ?
         FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.from_store_id, item.sku_id, item.sku_name, shipQty, shipQty, order.transfer_no, userId ?? null, tenantId, order.from_store_id, item.sku_id, tenantId]
      );

      await (conn as any).execute(
        "UPDATE t_transfer_order_item SET transferred_qty = transferred_qty + ? WHERE id = ? AND tenant_id = ?",
        [shipQty, item.id, tenantId]
      );

      await (conn as any).execute(
        `INSERT INTO t_transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'OUT', ?, ?, ?)`,
        [id, item.id, order.from_store_id, item.sku_id, shipQty, userId ?? null, tenantId]
      );
    }

    await (conn as any).execute(
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
    const [rows] = await (conn as any).execute(
      "SELECT * FROM t_transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as unknown as Record<string, unknown>[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "TRANSIT") throw new Error("仅在途状态可收货");

    let allReceived = true;

    for (const item of items) {
      const [itemRows] = await (conn as any).execute(
        "SELECT * FROM transfer_order_item WHERE id = ? AND transfer_order_id = ? AND tenant_id = ? FOR UPDATE",
        [item.itemId, id, tenantId]
      );
      const detail = (itemRows as unknown as Record<string, unknown>[])[0];
      if (!detail) throw new Error("明细不存在");

      const remaining = Number(detail.quantity) - Number(detail.received_qty);
      if (item.receivedQty > remaining) {
        throw new Error(`SKU ${detail.sku_name} 收货数量超出待收数量(剩余 ${remaining})`);
      }

      const [invRows] = await (conn as any).execute(
        "SELECT * FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.to_store_id, detail.sku_id, tenantId]
      );
      const inv = (invRows as unknown as Record<string, unknown>[])[0];

      if (inv) {
        await (conn as any).execute(
          "UPDATE t_inventory_balance SET available_qty = available_qty + ?, locked_qty = GREATEST(locked_qty - ?, 0) WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
          [item.receivedQty, item.receivedQty, order.to_store_id, detail.sku_id, tenantId]
        );
      } else {
        await (conn as any).execute(
          `INSERT INTO t_inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, tenantId]
        );
      }

      await (conn as any).execute(
        `INSERT INTO t_inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_IN', ?, available_qty - ?, available_qty, ?, ?, NOW(), ?
         FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, item.receivedQty, order.transfer_no, userId ?? null, tenantId, order.to_store_id, detail.sku_id, tenantId]
      );

      await (conn as any).execute(
        "UPDATE t_transfer_order_item SET received_qty = received_qty + ? WHERE id = ? AND tenant_id = ?",
        [item.receivedQty, item.itemId, tenantId]
      );

      await (conn as any).execute(
        `INSERT INTO t_transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'IN', ?, ?, ?)`,
        [id, item.itemId, order.to_store_id, detail.sku_id, item.receivedQty, userId ?? null, tenantId]
      );

      const [checkRows] = await (conn as any).execute(
        "SELECT received_qty, quantity FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
        [id, tenantId]
      );
      for (const row of checkRows as unknown as Record<string, unknown>[]) {
        if (Number(row.received_qty) < Number(row.quantity)) {
          allReceived = false;
          break;
        }
      }
    }

    if (allReceived) {
      await (conn as any).execute(
        "UPDATE t_transfer_order SET status = 'RECEIVED', actual_date = CURDATE(), received_by = ?, received_at = NOW() WHERE id = ? AND tenant_id = ?",
        [userId ?? null, id, tenantId]
      );
    }
  });

  return { transferOrderId: id };
}

export async function getInTransitOrders(storeId: number, tenantId: string) {
  const records = await queryWithTenant<any>(
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
  const records = await queryWithTenant<any>(
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
