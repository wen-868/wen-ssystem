import { query, queryOne } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function getCurrentShift(tenantId: string, storeId: number) {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today} 00:00:00`;

  // 获取最早一笔销售时间作为班次开始时间
  const firstSale = await queryOne<any>(
    `SELECT MIN(created_at) AS startTime
     FROM sale_bill
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

  const salesRow = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalSales,
            COUNT(*) AS orderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CASH' THEN 1 ELSE 0 END), 0) AS cashOrderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CREDIT' THEN 1 ELSE 0 END), 0) AS creditOrderCount
     FROM sale_bill
     WHERE store_id = ? AND tenant_id = ?
       AND DATE(created_at) = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId, today]
  );

  const returnRow = await queryOne<any>(
    `SELECT COALESCE(COUNT(*), 0) AS returnOrderCount
     FROM sale_return
     WHERE tenant_id = ?
       AND DATE(created_at) = ?`,
    [tenantId, today]
  );

  const receivedRow = await queryOne<any>(
    `SELECT COALESCE(SUM(amount), 0) AS totalReceived
     FROM payment_order
     WHERE tenant_id = ?
       AND DATE(paid_at) = ?
       AND status = 'SUCCESS'`,
    [tenantId, today]
  );

  const channelRows = await query<any>(
    `SELECT channel, COALESCE(SUM(amount), 0) AS amount
     FROM payment_order
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
    paymentBreakdown: channelRows.map((r: any) => ({
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
    `INSERT INTO daily_settlement (settle_date, shift_no, store_id, operator_id, tenant_id,
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
  const rows = await query<any>(
    `SELECT settle_date, shift_no, total_sales, total_received, status, created_at
     FROM daily_settlement
     WHERE store_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [storeId, tenantId, pageSize, offset]
  );
  return rows;
}