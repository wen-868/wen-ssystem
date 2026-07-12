import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function createHoldOrder(params: {
  customerName: string; customerMobile: string; amount: number;
  remark: string; items: any[]; storeId: number; tenantId: string;
}) {
  const { customerName, customerMobile, amount, remark, items, storeId, tenantId } = params;
  const holdNo = makeBizNo("GD");
  const payload = JSON.stringify({ customerName, customerMobile, amount, remark, items });
  await queryWithTenant(
    `INSERT INTO t_hold_order (hold_no, store_id, customer_name, customer_mobile, amount, payload, remark, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)`,
    [holdNo, storeId, customerName, customerMobile, amount, payload, remark, tenantId],
    tenantId
  );
  return { holdNo, status: "HELD" };
}

export async function listHoldOrders(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT hold_no AS holdNo, store_id AS storeId, customer_name AS customerName, customer_mobile AS customerMobile, amount, remark, status, created_at AS createdAt FROM t_hold_order WHERE tenant_id = ? AND status = 'HELD' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM t_hold_order WHERE tenant_id = ? AND status = 'HELD'", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function restoreHoldOrder(holdNo: string, tenantId: string) {
  const hold = await queryOneWithTenant<any>(
    `SELECT hold_no AS holdNo, customer_name AS customerName, customer_mobile AS customerMobile, amount, payload, remark, status, created_at AS createdAt FROM t_hold_order WHERE hold_no = ? AND status = 'HELD' AND tenant_id = ?`,
    [holdNo, tenantId],
    tenantId
  );
  if (!hold) return null;
  const payload = typeof hold.payload === "string" ? JSON.parse(hold.payload) : hold.payload;
  return { ...hold, ...payload };
}

export async function deleteHoldOrder(holdNo: string, tenantId: string) {
  await queryWithTenant(
    `UPDATE t_hold_order SET status = 'DELETED', updated_at = NOW() WHERE hold_no = ? AND tenant_id = ?`,
    [holdNo, tenantId],
    tenantId
  );
  return { holdNo, status: "DELETED" };
}

export async function listCollectionLinks(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT link_no AS linkNo, source_type AS sourceType, source_no AS sourceNo, amount, paid_amount AS paidAmount, status, share_channel AS shareChannel, token, expire_at AS expireAt, created_at AS createdAt FROM t_collection_link WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM t_collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listPaymentOrders(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo, amount, status, channel AS paymentMethod, paid_at AS paidAt, created_at AS createdAt FROM t_payment_order WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM t_payment_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listRefundOrders(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo, amount, reason, status, created_at AS createdAt FROM t_refund_order WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM t_refund_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}