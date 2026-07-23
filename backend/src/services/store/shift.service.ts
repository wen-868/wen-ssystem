import { query, queryOne } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 首笔销售时间行 */
interface FirstSaleRow {
  startTime: Date | string | null;
}

/** 销售统计行 */
interface SalesStatsRow {
  totalSales: number;
  orderCount: number;
  cashOrderCount: number;
  creditOrderCount: number;
}

/** 退货统计行 */
interface ReturnStatsRow {
  returnOrderCount: number;
}

/** 收款统计行 */
interface ReceivedStatsRow {
  totalReceived: number;
}

/** 支付渠道行 */
interface PaymentChannelRow {
  channel: string;
  amount: number;
}

/** 班次历史行 */
interface ShiftHistoryRow {
  settle_date: Date | string;
  shift_no: string;
  total_sales: number;
  total_received: number;
  status: string;
  created_at: Date | string;
}

export async function getCurrentShift(tenantId: string, storeId: number) {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today} 00:00:00`;

  // 获取最早一笔销售时间作为班次开始时间
  const firstSale = await queryOne<FirstSaleRow>(
    `SELECT MIN(created_at) AS startTime
     FROM t_sale_bill
     WHERE store_id = ? AND tenant_id = ?
       AND DATE(created_at) = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId, today]
  );

  const startTime = firstSale?.startTime ?? todayStart;
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = now.getTime() - start.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const operatingHours = `${hours}时${minutes}分`;

  const salesRow = await queryOne<SalesStatsRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalSales,
            COUNT(*) AS orderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CASH' THEN 1 ELSE 0 END), 0) AS cashOrderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CREDIT' THEN 1 ELSE 0 END), 0) AS creditOrderCount
     FROM t_sale_bill
     WHERE store_id = ? AND tenant_id = ?
       AND DATE(created_at) = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId, today]
  );

  const returnRow = await queryOne<ReturnStatsRow>(
    `SELECT COALESCE(COUNT(*), 0) AS returnOrderCount
     FROM t_sale_return
     WHERE tenant_id = ?
       AND DATE(created_at) = ?`,
    [tenantId, today]
  );

  const receivedRow = await queryOne<ReceivedStatsRow>(
    `SELECT COALESCE(SUM(amount), 0) AS totalReceived
     FROM t_payment_order
     WHERE tenant_id = ?
       AND DATE(paid_at) = ?
       AND status = 'SUCCESS'`,
    [tenantId, today]
  );

  const channelRows = await query<PaymentChannelRow>(
    `SELECT channel, COALESCE(SUM(amount), 0) AS amount
     FROM t_payment_order
     WHERE tenant_id = ?
       AND DATE(paid_at) = ?
       AND status = 'SUCCESS'
     GROUP BY channel`,
    [tenantId, today]
  );

  return {
    shiftDate: today,
    startTime: startTime,
    operatingHours,
    totalSales: Number(salesRow?.totalSales ?? 0),
    orderCount: Number(salesRow?.orderCount ?? 0),
    cashOrderCount: Number(salesRow?.cashOrderCount ?? 0),
    creditOrderCount: Number(salesRow?.creditOrderCount ?? 0),
    returnOrderCount: Number(returnRow?.returnOrderCount ?? 0),
    totalReceived: Number(receivedRow?.totalReceived ?? 0),
    paymentBreakdown: channelRows.map((r) => ({
      channel: r.channel,
      amount: Number(r.amount)
    }))
  };
}

export async function settleShift(tenantId: string, storeId: number, operatorId: number, actualAmount: number) {
  const today = new Date().toISOString().split("T")[0];
  const shiftData = await getCurrentShift(tenantId, storeId);

  const settleNo = makeBizNo("BJ");

  await query(
    `INSERT INTO t_daily_settlement (settle_date, shift_no, store_id, operator_id, tenant_id,
      total_sales, total_received, total_refund, cash_amount, wechat_amount, alipay_amount, transfer_amount, other_amount,
      status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'COMPLETED', '')`,
    [
      today, settleNo, storeId, operatorId, tenantId,
      shiftData.totalSales, shiftData.totalReceived,
      shiftData.paymentBreakdown.find((b: any) => b.channel === "CASH")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b: any) => b.channel === "WECHAT")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b: any) => b.channel === "ALIPAY")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b: any) => b.channel === "TRANSFER")?.amount ?? 0,
      0
    ]
  );

  return { ...shiftData, settleNo };
}

export async function getShiftHistory(tenantId: string, storeId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = await query<ShiftHistoryRow>(
    `SELECT settle_date, shift_no, total_sales, total_received, status, created_at
     FROM t_daily_settlement
     WHERE store_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [storeId, tenantId, pageSize, offset]
  );
  return rows;
}