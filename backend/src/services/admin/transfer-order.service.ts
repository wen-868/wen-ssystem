import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// ========== 类型定义 ==========
export interface TransferOrderItem {
  skuId: number;
  skuName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateTransferOrderParams {
  tenantId: string;
  userId: number | null;
  userName?: string;
  fromStoreId: number;
  fromStoreName?: string;
  toStoreId: number;
  toStoreName?: string;
  expectedDate?: string;
  remark?: string;
  items: TransferOrderItem[];
}

export interface ListTransferOrdersParams {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: string;
  fromStoreId?: number;
  toStoreId?: number;
  storeId?: number;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}

export interface UpdateTransferOrderParams {
  expectedDate?: string;
  remark?: string;
  items?: TransferOrderItem[];
}

// ========== 类型定义 ==========

/** INSERT 返回结果行 */
interface InsertResultRow {
  insertId: number;
  affectedRows?: number;
}

/** 调拨单列表行 */
interface TransferOrderListRow {
  id: number;
  transferNo: string;
  fromStoreId: number | string;
  fromStoreName: string | null;
  toStoreId: number | string;
  toStoreName: string | null;
  status: string;
  expectedDate: string | Date | null;
  totalAmount: number | string;
  totalItems: number | string;
  remark: string | null;
  createdBy: number | string | null;
  createdByName: string | null;
  approvedBy: number | string | null;
  approvedByName: string | null;
  approvedAt: string | Date | null;
  shippedBy: number | string | null;
  shippedByName: string | null;
  shippedAt: string | Date | null;
  receivedBy: number | string | null;
  receivedByName: string | null;
  receivedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** COUNT(*) AS total 行 */
interface CountTotalRow {
  total: number | string;
}

/** 调拨单详情行（含取消原因） */
interface TransferOrderDetailRow {
  id: number;
  transferNo: string;
  fromStoreId: number | string;
  fromStoreName: string | null;
  toStoreId: number | string;
  toStoreName: string | null;
  status: string;
  expectedDate: string | Date | null;
  totalAmount: number | string;
  totalItems: number | string;
  remark: string | null;
  cancelReason: string | null;
  createdBy: number | string | null;
  createdByName: string | null;
  approvedBy: number | string | null;
  approvedByName: string | null;
  approvedAt: string | Date | null;
  shippedBy: number | string | null;
  shippedByName: string | null;
  shippedAt: string | Date | null;
  receivedBy: number | string | null;
  receivedByName: string | null;
  receivedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

/** 调拨单明细行 */
interface TransferOrderItemRow {
  id: number;
  transferOrderId: number | string;
  transferNo: string;
  skuId: number | string;
  skuName: string;
  quantity: number | string;
  unitPrice: number | string;
  subtotal: number | string;
}

/** 调拨单状态检查行 */
interface TransferOrderStatusRow {
  id: number;
  status: string;
}

/** 调拨单出库检查行 */
interface TransferOrderOutCheckRow {
  id: number;
  status: string;
  fromStoreId: number | string;
  transferNo: string;
}

/** 调拨单出库明细简要行 */
interface TransferOrderItemBriefRow extends RowDataPacket {
  skuId: number | string;
  quantity: number | string;
}

/** 调拨单入库检查行 */
interface TransferOrderInCheckRow {
  id: number;
  status: string;
  toStoreId: number | string;
  transferNo: string;
}

/** 调拨单入库明细行（含单价） */
interface TransferOrderItemInRow extends RowDataPacket {
  skuId: number | string;
  quantity: number | string;
  unitPrice: number | string;
}

/** 调拨单状态统计行 */
interface TransferOrderStatusCountRow {
  status: string;
  count: number | string;
}

/** COALESCE(SUM, 0) AS amount 行 */
interface CountAmountRow {
  amount: number | string;
}

// ========== 创建调拨单 ==========
export async function createTransferOrder(params: CreateTransferOrderParams) {
  const { tenantId, userId, userName, fromStoreId, fromStoreName, toStoreId, toStoreName, expectedDate, remark, items } = params;

  if (fromStoreId === toStoreId) {
    throw Object.assign(new Error("调出门店和调入门店不能相同"), { statusCode: 400 });
  }
  if (!items || items.length === 0) {
    throw Object.assign(new Error("调拨单明细不能为空"), { statusCode: 400 });
  }

  const transferNo = makeBizNo("DB");

  const result = await transaction(async (conn) => {
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_transfer_order (
        transfer_no, from_store_id, from_store_name, to_store_id, to_store_name,
        status, expected_date, total_amount, total_items, remark,
        created_by, created_by_name, tenant_id
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)`,
      [
        transferNo, fromStoreId, fromStoreName ?? null, toStoreId, toStoreName ?? null,
        expectedDate ?? null, totalAmount, items.length, remark ?? null,
        userId ?? null, userName ?? null, tenantId
      ]
    );
    const orderId = insertResult.insertId as number;

    for (const item of items) {
      const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      await conn.execute(
        `INSERT INTO t_transfer_order_item (
          transfer_order_id, transfer_no, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, transferNo, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId]
      );
    }

    return { id: orderId, transferNo };
  });

  return result;
}

// ========== 调拨单列表 ==========
export async function listTransferOrders(params: ListTransferOrdersParams) {
  const { tenantId, page, pageSize, status, fromStoreId, toStoreId, storeId, dateStart, dateEnd, keyword } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["to.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (status) {
    conditions.push("to.status = ?");
    queryParams.push(status);
  }
  if (fromStoreId !== undefined) {
    conditions.push("to.from_store_id = ?");
    queryParams.push(fromStoreId);
  }
  if (toStoreId !== undefined) {
    conditions.push("to.to_store_id = ?");
    queryParams.push(toStoreId);
  }
  if (storeId !== undefined) {
    conditions.push("(to.from_store_id = ? OR to.to_store_id = ?)");
    queryParams.push(storeId, storeId);
  }
  if (dateStart) {
    conditions.push("DATE(to.created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(to.created_at) <= ?");
    queryParams.push(dateEnd);
  }
  if (keyword) {
    conditions.push("(to.transfer_no LIKE ? OR to.remark LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<TransferOrderListRow>(
    `SELECT to.id, to.transfer_no AS transferNo, to.from_store_id AS fromStoreId, to.from_store_name AS fromStoreName,
            to.to_store_id AS toStoreId, to.to_store_name AS toStoreName, to.status, to.expected_date AS expectedDate,
            to.total_amount AS totalAmount, to.total_items AS totalItems, to.remark,
            to.created_by AS createdBy, to.created_by_name AS createdByName,
            to.approved_by AS approvedBy, to.approved_by_name AS approvedByName, to.approved_at AS approvedAt,
            to.shipped_by AS shippedBy, to.shipped_by_name AS shippedByName, to.shipped_at AS shippedAt,
            to.received_by AS receivedBy, to.received_by_name AS receivedByName, to.received_at AS receivedAt,
            to.created_at AS createdAt, to.updated_at AS updatedAt
     FROM t_transfer_order to
     ${where}
     ORDER BY to.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_transfer_order to ${where}`,
    queryParams,
    tenantId
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 调拨单详情 ==========
export async function getTransferOrderDetail(id: number, tenantId: string) {
  const order = await queryOneWithTenant<TransferOrderDetailRow>(
    `SELECT id, transfer_no AS transferNo, from_store_id AS fromStoreId, from_store_name AS fromStoreName,
            to_store_id AS toStoreId, to_store_name AS toStoreName, status, expected_date AS expectedDate,
            total_amount AS totalAmount, total_items AS totalItems, remark, cancel_reason AS cancelReason,
            created_by AS createdBy, created_by_name AS createdByName,
            approved_by AS approvedBy, approved_by_name AS approvedByName, approved_at AS approvedAt,
            shipped_by AS shippedBy, shipped_by_name AS shippedByName, shipped_at AS shippedAt,
            received_by AS receivedBy, received_by_name AS receivedByName, received_at AS receivedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_transfer_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );

  if (!order) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }

  const items = await queryWithTenant<TransferOrderItemRow>(
    `SELECT id, transfer_order_id AS transferOrderId, transfer_no AS transferNo,
            sku_id AS skuId, sku_name AS skuName, quantity, unit_price AS unitPrice, subtotal
     FROM t_transfer_order_item WHERE transfer_order_id = ?
     ORDER BY id ASC`,
    [id],
    tenantId
  );

  return { ...order, items };
}

// ========== 更新调拨单 ==========
export async function updateTransferOrder(id: number, tenantId: string, params: UpdateTransferOrderParams) {
  const { expectedDate, remark, items } = params;

  const existing = await queryOneWithTenant<TransferOrderStatusRow>(
    "SELECT id, status FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态可编辑"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    const sets: string[] = [];
    const values: (string | number | null | Date | boolean)[] = [];

    if (expectedDate !== undefined) {
      sets.push("expected_date = ?");
      values.push(expectedDate);
    }
    if (remark !== undefined) {
      sets.push("remark = ?");
      values.push(remark);
    }

    if (sets.length > 0) {
      values.push(id, tenantId);
      await conn.execute(
        `UPDATE t_transfer_order SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
        values
      );
    }

    if (items && items.length > 0) {
      await conn.execute(
        "DELETE FROM t_transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
        [id, tenantId]
      );

      let totalAmount = 0;
      for (const item of items) {
        const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        totalAmount += subtotal;
        await conn.execute(
          `INSERT INTO t_transfer_order_item (
            transfer_order_id, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId]
        );
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      await conn.execute(
        "UPDATE t_transfer_order SET total_amount = ?, total_items = ? WHERE id = ? AND tenant_id = ?",
        [totalAmount, items.length, id, tenantId]
      );
    }
  });

  return { id };
}

// ========== 删除调拨单 ==========
export async function deleteTransferOrder(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<TransferOrderStatusRow>(
    "SELECT id, status FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT" && existing.status !== "CANCELLED") {
    throw Object.assign(new Error("仅草稿或已取消状态可删除"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    await conn.execute(
      "DELETE FROM t_transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    await conn.execute(
      "DELETE FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { success: true };
}

// ========== 提交审核 ==========
export async function submitTransferOrder(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<TransferOrderStatusRow>(
    "SELECT id, status FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态可提交审核"), { statusCode: 400 });
  }

  await queryWithTenant(
    "UPDATE t_transfer_order SET status = 'PENDING' WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );

  return { id };
}

// ========== 审核通过 ==========
export async function approveTransferOrder(
  id: number,
  tenantId: string,
  params: { approverId: number; approverName?: string }
) {
  const { approverId, approverName } = params;

  const existing = await queryOneWithTenant<TransferOrderStatusRow>(
    "SELECT id, status FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("仅待审核状态可审核通过"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_transfer_order SET status = 'APPROVED', approved_by = ?, approved_by_name = ?, approved_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [approverId, approverName ?? null, id, tenantId],
    tenantId
  );

  return { id };
}

// ========== 审核驳回 ==========
export async function rejectTransferOrder(
  id: number,
  tenantId: string,
  params: { approverId: number; approverName?: string; rejectReason?: string }
) {
  const { approverId, approverName, rejectReason } = params;

  const existing = await queryOneWithTenant<TransferOrderStatusRow>(
    "SELECT id, status FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("仅待审核状态可驳回"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_transfer_order SET status = 'REJECTED', approved_by = ?, approved_by_name = ?,
     reject_reason = ?, approved_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [approverId, approverName ?? null, rejectReason ?? null, id, tenantId],
    tenantId
  );

  return { id };
}

// ========== 确认出库 ==========
export async function confirmTransferOut(
  id: number,
  tenantId: string,
  params: { operatorId: number; operatorName?: string }
) {
  const { operatorId, operatorName } = params;

  const existing = await queryOneWithTenant<TransferOrderOutCheckRow>(
    "SELECT id, status, from_store_id AS fromStoreId, transfer_no AS transferNo FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "APPROVED") {
    throw Object.assign(new Error("仅已审核状态可确认出库"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    // 更新状态
    await conn.execute(
      `UPDATE t_transfer_order SET status = 'TRANSIT', shipped_by = ?, shipped_by_name = ?, shipped_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [operatorId, operatorName ?? null, id, tenantId]
    );

    // 查询明细
    const items = await conn.query<RowDataPacket[]>(
      `SELECT sku_id AS skuId, quantity
       FROM t_transfer_order_item WHERE transfer_order_id = ?`,
      [id]
    ) as unknown as TransferOrderItemBriefRow[];

    // 扣减调出门店库存
    for (const item of items) {
      await conn.execute(
        `UPDATE t_inventory_balance
         SET physical_qty = GREATEST(physical_qty - ?, 0),
             available_qty = GREATEST(available_qty - ?, 0)
         WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [item.quantity, item.quantity, existing.fromStoreId, item.skuId, tenantId]
      );

      // 写入库存台账（出库）
      await conn.execute(
        `INSERT INTO t_inventory_ledger (sku_id, store_id, change_type, change_qty, biz_no, biz_type, tenant_id)
         VALUES (?, ?, 'OUT', ?, ?, 'TRANSFER_OUT', ?)`,
        [item.skuId, existing.fromStoreId, item.quantity, existing.transferNo, tenantId]
      );
    }
  });

  return { id };
}

// ========== 确认入库 ==========
export async function confirmTransferIn(
  id: number,
  tenantId: string,
  params: { operatorId: number; operatorName?: string }
) {
  const { operatorId, operatorName } = params;

  const existing = await queryOneWithTenant<TransferOrderInCheckRow>(
    "SELECT id, status, to_store_id AS toStoreId, transfer_no AS transferNo FROM t_transfer_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("调拨单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "TRANSIT") {
    throw Object.assign(new Error("仅运输中状态可确认入库"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    // 更新状态
    await conn.execute(
      `UPDATE t_transfer_order SET status = 'RECEIVED', received_by = ?, received_by_name = ?, received_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [operatorId, operatorName ?? null, id, tenantId]
    );

    // 查询明细
    const items = await conn.query<RowDataPacket[]>(
      `SELECT sku_id AS skuId, quantity, unit_price AS unitPrice
       FROM t_transfer_order_item WHERE transfer_order_id = ?`,
      [id]
    ) as unknown as TransferOrderItemInRow[];

    // 增加调入门店库存
    for (const item of items) {
      await conn.execute(
        `UPDATE t_inventory_balance
         SET physical_qty = physical_qty + ?,
             available_qty = available_qty + ?
         WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [item.quantity, item.quantity, existing.toStoreId, item.skuId, tenantId]
      );

      // 写入库存台账（入库）
      const amount = Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100;
      await conn.execute(
        `INSERT INTO t_inventory_ledger (sku_id, store_id, change_type, change_qty, unit_price, amount, biz_no, biz_type, tenant_id)
         VALUES (?, ?, 'IN', ?, ?, ?, ?, 'TRANSFER_IN', ?)`,
        [item.skuId, existing.toStoreId, item.quantity, item.unitPrice, amount, existing.transferNo, tenantId]
      );
    }
  });

  return { id };
}

// ========== 调拨统计 ==========
export async function getTransferStats(tenantId: string) {
  // 本月统计
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotalRow = await queryOneWithTenant<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM t_transfer_order WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId],
    tenantId
  );

  // 各状态统计
  const statusStats = await queryWithTenant<TransferOrderStatusCountRow>(
    "SELECT status, COUNT(*) AS count FROM t_transfer_order WHERE tenant_id = ? GROUP BY status",
    [tenantId],
    tenantId
  );

  const statusMap: Record<string, number> = {};
  for (const row of statusStats) {
    statusMap[row.status] = Number(row.count);
  }

  // 本月调拨金额
  const monthAmountRow = await queryOneWithTenant<CountAmountRow>(
    "SELECT COALESCE(SUM(total_amount), 0) AS amount FROM t_transfer_order WHERE created_at >= ? AND status IN ('TRANSIT', 'RECEIVED') AND tenant_id = ?",
    [monthStartStr, tenantId],
    tenantId
  );

  return {
    monthTotal: monthTotalRow?.total ?? 0,
    monthAmount: monthAmountRow?.amount ?? 0,
    draftCount: statusMap["DRAFT"] ?? 0,
    pendingCount: statusMap["PENDING"] ?? 0,
    approvedCount: statusMap["APPROVED"] ?? 0,
    transitCount: statusMap["TRANSIT"] ?? 0,
    receivedCount: statusMap["RECEIVED"] ?? 0,
    rejectedCount: statusMap["REJECTED"] ?? 0,
    cancelledCount: statusMap["CANCELLED"] ?? 0,
  };
}
