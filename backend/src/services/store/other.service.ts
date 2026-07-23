import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 挂单行（列表） */
interface HoldOrderRow {
  holdNo: string;
  storeId: number;
  customerName: string;
  customerMobile: string;
  amount: number | string;
  remark: string;
  status: string;
  createdAt: string | Date;
}

/** 挂单行（详情，含 payload） */
interface HoldOrderDetailRow {
  holdNo: string;
  customerName: string;
  customerMobile: string;
  amount: number | string;
  payload: string | Record<string, unknown>;
  remark: string;
  status: string;
  createdAt: string | Date;
}

/** 收款链接行 */
interface CollectionLinkRow {
  linkNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  paidAmount: number | string;
  status: string;
  shareChannel: string;
  token: string;
  expireAt: string | Date;
  createdAt: string | Date;
}

/** 支付单行 */
interface PaymentOrderRow {
  payNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  status: string;
  paymentMethod: string;
  paidAt: string | Date;
  createdAt: string | Date;
}

/** 退款单行 */
interface RefundOrderRow {
  refundNo: string;
  payNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  reason: string;
  status: string;
  createdAt: string | Date;
}

/** 总数行（COUNT(*) AS total） */
interface CountTotalRow {
  total: number;
}

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
  const records = await queryWithTenant<HoldOrderRow>(
    `SELECT hold_no AS holdNo, store_id AS storeId, customer_name AS customerName, customer_mobile AS customerMobile, amount, remark, status, created_at AS createdAt FROM t_hold_order WHERE tenant_id = ? AND status = 'HELD' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_hold_order WHERE tenant_id = ? AND status = 'HELD'", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function restoreHoldOrder(holdNo: string, tenantId: string) {
  const hold = await queryOneWithTenant<HoldOrderDetailRow>(
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
  const records = await queryWithTenant<CollectionLinkRow>(
    `SELECT link_no AS linkNo, source_type AS sourceType, source_no AS sourceNo, amount, paid_amount AS paidAmount, status, share_channel AS shareChannel, token, expire_at AS expireAt, created_at AS createdAt FROM t_collection_link WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listPaymentOrders(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<PaymentOrderRow>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo, amount, status, channel AS paymentMethod, paid_at AS paidAt, created_at AS createdAt FROM t_payment_order WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_payment_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listRefundOrders(params: {
  page: number; pageSize: number; tenantId: string;
}) {
  const { page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<RefundOrderRow>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo, amount, reason, status, created_at AS createdAt FROM t_refund_order WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_refund_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}