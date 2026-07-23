import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { RowDataPacket } from "mysql2";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 应收列表行 */
interface ReceivableRow {
  receivableNo: string;
  sourceType: string;
  sourceNo: string;
  customerName: string;
  customerMobile: string;
  receivableAmount: number;
  receivedAmount: number;
  unreceivedAmount: number;
  status: string;
  createdAt: Date | string;
}

/** 应收账户行（事务查询用） */
interface ReceivableAccountRow extends RowDataPacket {
  receivable_no: string;
  source_no: string;
  received_amount: number;
  receivable_amount: number;
  unreceived_amount: number;
}

/** 总数行 */
interface CountRow {
  total: number;
}

/** 计数行 */
interface CntRow {
  cnt: number;
}

/** 汇总行 */
interface TotalRow {
  total: number;
}

/** 日销售行 */
interface DailySaleRow {
  date: string;
  count: number;
  amount: number;
}

export async function listReceivables(params: {
  page: number; pageSize: number; storeId: number | null;
  status: string | null; keyword: string; tenantId: string;
}) {
  const { page, pageSize, storeId, status, keyword, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const kw = `%${keyword}%`;
  const records = await queryWithTenant<ReceivableRow>(
    `SELECT receivable_no AS receivableNo, source_type AS sourceType, source_no AS sourceNo, customer_name AS customerName, customer_mobile AS customerMobile, receivable_amount AS receivableAmount, received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount, status, created_at AS createdAt FROM t_receivable_account WHERE tenant_id = ? AND (? IS NULL OR store_id = ?) AND (? IS NULL OR status = ?) AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?) ORDER BY id DESC LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, status, status, kw, kw, kw, kw, pageSize, offset],
    tenantId
  );
  const total = await queryOneWithTenant<CountRow>(
    `SELECT COUNT(*) AS total FROM t_receivable_account WHERE tenant_id = ? AND (? IS NULL OR store_id = ?) AND (? IS NULL OR status = ?) AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [tenantId, storeId, storeId, status, status, kw, kw, kw, kw],
    tenantId
  );
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function paymentOnReceivable(params: {
  receivableNo: string; amount: number; paymentMethod: string;
  remark?: string; tenantId: string;
}) {
  const { receivableNo, amount, paymentMethod, remark, tenantId } = params;
  return transaction(async (conn) => {
    const [rows] = await conn.query<ReceivableAccountRow[]>(
      `SELECT receivable_no, source_no, received_amount, receivable_amount, unreceived_amount FROM t_receivable_account WHERE receivable_no = ? AND tenant_id = ? FOR UPDATE`,
      [receivableNo, tenantId]
    );
    const receivable = rows[0];
    if (!receivable) throw new Error("应收不存在");
    if (amount > Number(receivable.unreceived_amount)) throw new Error("收款金额不能超过未收金额");
    const receivedAmount = Number(receivable.received_amount) + amount;
    const unreceivedAmount = Math.max(Number(receivable.receivable_amount) - receivedAmount, 0);
    const status = unreceivedAmount === 0 ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE t_receivable_account SET received_amount = ?, unreceived_amount = ?, status = ?, last_payment_time = NOW() WHERE receivable_no = ? AND tenant_id = ?`,
      [receivedAmount, unreceivedAmount, status, receivableNo, tenantId]
    );
    await conn.execute(
      `INSERT INTO t_payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id) VALUES (?, 'RECEIVABLE', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), receivableNo, paymentMethod, amount, tenantId]
    );
    return { receivableNo, receivedAmount, unreceivedAmount, status };
  });
}

export async function getDashboard(params: {
  storeId: number | null; tenantId: string;
}) {
  const { storeId, tenantId } = params;
  const whereStore = storeId ? "WHERE tenant_id = ? AND store_id = ?" : "WHERE tenant_id = ?";
  const p = storeId ? [tenantId, storeId] : [tenantId];
  const todayOrders = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_miniapp_order ${whereStore}`, p, tenantId);
  const pendingOrders = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_miniapp_order ${whereStore} AND order_status = 'PENDING_PAYMENT'`, p, tenantId);
  const todaySales = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(receivable_amount), 0) AS total FROM t_sale_bill ${whereStore}`, p, tenantId);
  const unreceived = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(unreceived_amount), 0) AS total FROM t_sale_bill ${whereStore}`, p, tenantId);
  return {
    todayOrderCount: todayOrders?.cnt ?? 0,
    pendingOrderCount: pendingOrders?.cnt ?? 0,
    todaySalesAmount: todaySales?.total ?? 0,
    unReceivedAmount: unreceived?.total ?? 0,
    storeId
  };
}

export async function getDailySales(storeId: number | null, tenantId: string) {
  const where = storeId ? "WHERE sb.tenant_id = ? AND sb.store_id = ?" : "WHERE sb.tenant_id = ?";
  const p = storeId ? [tenantId, storeId] : [tenantId];
  const records = await queryWithTenant<DailySaleRow>(
    `SELECT DATE(sb.created_at) AS date, COUNT(*) AS count, COALESCE(SUM(sb.receivable_amount), 0) AS amount FROM t_sale_bill sb ${where} GROUP BY DATE(sb.created_at) ORDER BY date DESC LIMIT 7`,
    p,
    tenantId
  );
  return records.reverse();
}