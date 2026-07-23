import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { RowDataPacket } from "mysql2";

/** 报溢单项行 */
interface ProfitOrderItemRow extends RowDataPacket {
  skuId: number;
  qty: number;
  costPrice: number;
}

// ========== 报溢单列表 ==========
export async function listProfitOrders(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  storeId?: number;
  status?: string;
  profitType?: string;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}) {
  const { page, pageSize, tenantId, storeId, status, profitType, dateStart, dateEnd, keyword } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["po.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (storeId !== undefined) {
    conditions.push("po.store_id = ?");
    queryParams.push(storeId);
  }
  if (status) {
    conditions.push("po.status = ?");
    queryParams.push(status);
  }
  if (profitType) {
    conditions.push("po.profit_type = ?");
    queryParams.push(profitType);
  }
  if (dateStart) {
    conditions.push("DATE(po.created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(po.created_at) <= ?");
    queryParams.push(dateEnd);
  }
  if (keyword) {
    conditions.push("(po.profit_no LIKE ? OR po.reason LIKE ?)");
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT po.id, po.profit_no AS profitNo, po.store_id AS storeId, po.store_name AS storeName,
            po.profit_type AS profitType, po.total_qty AS totalQty, po.total_amount AS totalAmount,
            po.status, po.reason, po.operator_id AS operatorId, po.operator_name AS operatorName,
            po.auditor_id AS auditorId, po.auditor_name AS auditorName,
            po.audited_at AS auditedAt, po.remark, po.created_at AS createdAt,
            po.updated_at AS updatedAt
     FROM t_inventory_profit_order po
     ${where}
     ORDER BY po.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_inventory_profit_order po ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ========== 报溢单详情 ==========
export async function getProfitOrderDetail(id: number, tenantId: string) {
  const order = await queryOneWithTenant<any>(
    `SELECT id, profit_no AS profitNo, store_id AS storeId, store_name AS storeName,
            profit_type AS profitType, total_qty AS totalQty, total_amount AS totalAmount,
            status, reason, reject_reason AS rejectReason,
            operator_id AS operatorId, operator_name AS operatorName,
            auditor_id AS auditorId, auditor_name AS auditorName,
            audited_at AS auditedAt, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_inventory_profit_order WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!order) {
    throw Object.assign(new Error("报溢单不存在"), { statusCode: 404 });
  }
  const items = await queryWithTenant<any>(
    `SELECT id, profit_order_id AS profitOrderId, profit_no AS profitNo,
            sku_id AS skuId, sku_name AS skuName, barcode,
            specification, unit_name AS unitName, qty,
            cost_price AS costPrice, subtotal_amount AS subtotalAmount,
            profit_reason AS profitReason
     FROM t_inventory_profit_order_item WHERE profit_order_id = ?
     ORDER BY id ASC`,
    [id],
    tenantId
  );
  return { ...order, items };
}

// ========== 创建报溢单 ==========
export async function createProfitOrder(params: {
  storeId: number;
  storeName?: string;
  profitType: string;
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
    profitReason?: string;
  }>;
}) {
  const { storeId, storeName, profitType, reason, remark, operatorId, operatorName, tenantId, items } = params;

  if (!items || items.length === 0) {
    throw Object.assign(new Error("报溢单明细不能为空"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    const profitNo = makeBizNo("BY");
    let totalQty = 0;
    let totalAmount = 0;

    for (const item of items) {
      totalQty += item.qty;
      totalAmount += item.qty * item.costPrice;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    const [insertResult] = await conn.execute<any>(
      `INSERT INTO t_inventory_profit_order (profit_no, store_id, store_name, profit_type,
        total_qty, total_amount, status, reason, operator_id, operator_name, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
      [profitNo, storeId, storeName ?? null, profitType, totalQty, totalAmount,
        reason ?? null, operatorId, operatorName ?? null, remark ?? null, tenantId]
    );
    const profitOrderId = insertResult.insertId as number;

    for (const item of items) {
      const subtotalAmount = Math.round(item.qty * item.costPrice * 100) / 100;
      await conn.execute(
        `INSERT INTO t_inventory_profit_order_item (profit_order_id, profit_no, sku_id, sku_name,
          barcode, specification, unit_name, qty, cost_price, subtotal_amount, profit_reason, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [profitOrderId, profitNo, item.skuId, item.skuName, item.barcode ?? null,
          item.specification ?? null, item.unitName ?? null, item.qty,
          item.costPrice, subtotalAmount, item.profitReason ?? null, tenantId]
      );
    }

    return { id: profitOrderId, profitNo };
  });

  return result;
}

// ========== 审核通过报溢单 ==========
export async function approveProfitOrder(
  id: number,
  params: {
    auditorId: number;
    auditorName?: string;
    tenantId: string;
  }
) {
  const { auditorId, auditorName, tenantId } = params;

  const existing = await queryOneWithTenant<any>(
    "SELECT id, status, profit_no AS profitNo, store_id AS storeId FROM t_inventory_profit_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报溢单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING" && existing.status !== "DRAFT") {
    throw Object.assign(new Error("当前状态不允许审核通过"), { statusCode: 400 });
  }

  const result = await transaction(async (conn) => {
    // 更新状态
    await conn.execute(
      `UPDATE t_inventory_profit_order SET status = 'APPROVED', auditor_id = ?, auditor_name = ?, audited_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [auditorId, auditorName ?? null, id, tenantId]
    );

    // 查询明细
    const [items] = await conn.query<ProfitOrderItemRow[]>(
      `SELECT sku_id AS skuId, qty, cost_price AS costPrice
       FROM t_inventory_profit_order_item WHERE profit_order_id = ?`,
      [id]
    );

    // 更新库存余额（增加库存）
    for (const item of items) {
      await conn.execute(
        `UPDATE t_inventory_balance
         SET physical_qty = physical_qty + ?,
             available_qty = available_qty + ?
         WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [item.qty, item.qty, existing.storeId, item.skuId, tenantId]
      );

      // 写入库存台账
      const subtotalAmount = Math.round(item.qty * item.costPrice * 100) / 100;
      await conn.execute(
        `INSERT INTO t_inventory_ledger (sku_id, store_id, change_type, change_qty,
          unit_price, amount, biz_no, biz_type, tenant_id)
         VALUES (?, ?, 'IN', ?, ?, ?, ?, 'PROFIT', ?)`,
        [item.skuId, existing.storeId, item.qty, item.costPrice,
          subtotalAmount, existing.profitNo, tenantId]
      );
    }

    return { success: true };
  });

  return result;
}

// ========== 审核驳回报溢单 ==========
export async function rejectProfitOrder(
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
    "SELECT id, status FROM t_inventory_profit_order WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("报溢单不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING" && existing.status !== "DRAFT") {
    throw Object.assign(new Error("当前状态不允许驳回"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_inventory_profit_order SET status = 'REJECTED', auditor_id = ?, auditor_name = ?,
     reject_reason = ?, audited_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [auditorId, auditorName ?? null, rejectReason ?? null, id, tenantId],
    tenantId
  );

  return { success: true };
}
