import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { RowDataPacket } from "mysql2";

/** 报损单项行 */
interface LossOrderItemRow extends RowDataPacket {
  skuId: number;
  qty: number;
  costPrice: number;
}

// ========== 报损单列表 ==========
export async function listLossOrders(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  storeId?: number;
  status?: string;
  lossType?: string;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}) {
  const { page, pageSize, tenantId, storeId, status, lossType, dateStart, dateEnd, keyword } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["lo.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (storeId !== undefined) {
    conditions.push("lo.store_id = ?");
    queryParams.push(storeId);
  }
  if (status) {
    conditions.push("lo.status = ?");
    queryParams.push(status);
  }
  if (lossType) {
    conditions.push("lo.loss_type = ?");
    queryParams.push(lossType);
  }
  if (dateStart) {
    conditions.push("DATE(lo.created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(lo.created_at) <= ?");
    queryParams.push(dateEnd);
  }
  if (keyword) {
    conditions.push("(lo.loss_no LIKE ? OR lo.reason LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT lo.id, lo.loss_no AS lossNo, lo.store_id AS storeId, lo.store_name AS storeName,
            lo.loss_type AS lossType, lo.total_qty AS totalQty, lo.total_amount AS totalAmount,
            lo.status, lo.reason, lo.operator_id AS operatorId, lo.operator_name AS operatorName,
            lo.auditor_id AS auditorId, lo.auditor_name AS auditorName,
            lo.audited_at AS auditedAt, lo.remark, lo.created_at AS createdAt,
            lo.updated_at AS updatedAt
     FROM t_inventory_loss_order lo
     ${where}
     ORDER BY lo.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_inventory_loss_order lo ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 报损单详情 ==========
export async function getLossOrderDetail(id: number, tenantId: string) {
  const order = await queryOneWithTenant<any>(
    `SELECT id, loss_no AS lossNo, store_id AS storeId, store_name AS storeName,
            loss_type AS lossType, total_qty AS totalQty, total_amount AS totalAmount,
            status, reason, reject_reason AS rejectReason,
            operator_id AS operatorId, operator_name AS operatorName,
            auditor_id AS auditorId, auditor_name AS auditorName,
            audited_at AS auditedAt, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_inventory_loss_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!order) {
    throw Object.assign(new Error("报损单不存在"), { statusCode: 404 });
  }
  const items = await queryWithTenant<any>(
    `SELECT id, loss_order_id AS lossOrderId, loss_no AS lossNo,
            sku_id AS skuId, sku_name AS skuName, barcode,
            specification, unit_name AS unitName, qty,
            cost_price AS costPrice, subtotal_amount AS subtotalAmount,
            loss_reason AS lossReason
     FROM t_inventory_loss_order_item WHERE loss_order_id = ?
     ORDER BY id ASC`,
    [id],
    tenantId
  );
  return { ...order, items };
}

// ========== 创建报损单 ==========
export async function createLossOrder(params: {
  storeId: number;
  storeName?: string;
  lossType: string;
  reason?: string;
  remark?: string;
  operatorId: number;
  operatorName?: string;
  tenantId: string;
  items: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    specification?: string;
    unitName?: string;
    qty: number;
    costPrice: number;
    lossReason?: string;
  }>;
}) {
  const { storeId, storeName, lossType, reason, remark, operatorId, operatorName, tenantId, items } = params;

  if (!items || items.length === 0) {
    throw Object.assign(new Error("报损单明细不能为空"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const lossNo = makeBizNo("BS");
    let totalQty = 0;
    let totalAmount = 0;

    for (const item of items) {
      totalQty += item.qty;
      totalAmount += item.qty * item.costPrice;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    const [insertResult] = await conn.execute<any>(
      `INSERT INTO t_inventory_loss_order (loss_no, store_id, store_name, loss_type,
        total_qty, total_amount, status, reason, operator_id, operator_name, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
      [lossNo, storeId, storeName ?? null, lossType, totalQty, totalAmount,
        reason ?? null, operatorId, operatorName ?? null, remark ?? null, tenantId]
    );
    const lossOrderId = insertResult.insertId as number;

    for (const item of items) {
      const subtotalAmount = Math.round(item.qty * item.costPrice * 100) / 100;
      await conn.execute(
        `INSERT INTO t_inventory_loss_order_item (loss_order_id, loss_no, sku_id, sku_name,
          barcode, specification, unit_name, qty, cost_price, subtotal_amount, loss_reason, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [lossOrderId, lossNo, item.skuId, item.skuName, item.barcode ?? null,
          item.specification ?? null, item.unitName ?? null, item.qty,
          item.costPrice, subtotalAmount, item.lossReason ?? null, tenantId]
      );
    }

    return { id: lossOrderId, lossNo };
  });

  return result;
}

// ========== 审核通过报损单 ==========
export async function approveLossOrder(
  id: number,
  params: {
    auditorId: number;
    auditorName?: string;
    tenantId: string;
  }
) {
  const { auditorId, auditorName, tenantId } = params;

  const existing = await queryOneWithTenant<any>(
    "SELECT id, status, loss_no AS lossNo, store_id AS storeId FROM t_inventory_loss_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报损单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING" && existing.status !== "DRAFT") {
    throw Object.assign(new Error("当前状态不允许审核通过"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    // 更新状态
    await conn.execute(
      `UPDATE t_inventory_loss_order SET status = 'APPROVED', auditor_id = ?, auditor_name = ?, audited_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [auditorId, auditorName ?? null, id, tenantId]
    );

    // 查询明细
    const [items] = await conn.query<LossOrderItemRow[]>(
      `SELECT sku_id AS skuId, qty, cost_price AS costPrice
       FROM t_inventory_loss_order_item WHERE loss_order_id = ?`,
      [id]
    );

    // 更新库存余额（扣减库存）
    for (const item of items) {
      await conn.execute(
        `UPDATE t_inventory_balance
         SET physical_qty = GREATEST(physical_qty - ?, 0),
             available_qty = GREATEST(available_qty - ?, 0)
         WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [item.qty, item.qty, existing.storeId, item.skuId, tenantId]
      );

      // 写入库存台账
      const subtotalAmount = Math.round(item.qty * item.costPrice * 100) / 100;
      await conn.execute(
        `INSERT INTO t_inventory_ledger (sku_id, store_id, change_type, change_qty,
          unit_price, amount, biz_no, biz_type, tenant_id)
         VALUES (?, ?, 'OUT', ?, ?, ?, ?, 'LOSS', ?)`,
        [item.skuId, existing.storeId, item.qty, item.costPrice,
          subtotalAmount, existing.lossNo, tenantId]
      );
    }

    return { success: true };
  });

  return result;
}

// ========== 审核驳回报损单 ==========
export async function rejectLossOrder(
  id: number,
  params: {
    auditorId: number;
    auditorName?: string;
    rejectReason?: string;
    tenantId: string;
  }
) {
  const { auditorId, auditorName, rejectReason, tenantId } = params;

  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM t_inventory_loss_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报损单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING" && existing.status !== "DRAFT") {
    throw Object.assign(new Error("当前状态不允许驳回"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_inventory_loss_order SET status = 'REJECTED', auditor_id = ?, auditor_name = ?,
     reject_reason = ?, audited_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [auditorId, auditorName ?? null, rejectReason ?? null, id, tenantId],
    tenantId
  );

  return { success: true };
}
