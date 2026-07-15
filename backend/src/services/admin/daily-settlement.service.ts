import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function createDailySettlement(params: {
  settleDate: string;
  tenantId: string;
  operatorId: number;
}) {
  const { settleDate, tenantId, operatorId } = params;

  // 检查是否已有该日期的日结记录
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM daily_settlement WHERE settle_date = ? AND tenant_id = ?",
    [settleDate, tenantId],
    tenantId
  );
  if (existing) {
    throw Object.assign(new Error("该日期已有日结记录"), { statusCode: 400 });
  }

  // 从 payment_order 表按 channel 聚合当日真实收款数据
  const channelRows = await queryWithTenant<any>(
    `SELECT channel, COALESCE(SUM(amount), 0) AS amount
     FROM t_payment_order
     WHERE DATE(paid_at) = ? AND status = 'SUCCESS' AND tenant_id = ?
     GROUP BY channel`,
    [settleDate, tenantId],
    tenantId
  );

  const channelMap: Record<string, number> = {};
  for (const row of channelRows) {
    channelMap[row.channel] = Number(row.amount);
  }

  const cashAmount = channelMap["CASH"] ?? 0;
  const wechatAmount = channelMap["WECHAT"] ?? 0;
  const alipayAmount = channelMap["ALIPAY"] ?? 0;
  const transferAmount = channelMap["TRANSFER"] ?? 0;
  const otherAmount = channelMap["OTHER"] ?? 0;
  const totalReceived = cashAmount + wechatAmount + alipayAmount + transferAmount + otherAmount;

  // 从 sale_bill 聚合当日销售额和退款
  const salesRow = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalSales
     FROM t_sale_bill
     WHERE DATE(created_at) = ? AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?`,
    [settleDate, tenantId],
    tenantId
  );
  const totalSales = Number(salesRow?.totalSales ?? 0);

  const refundRow = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalRefund
     FROM t_sale_return
     WHERE DATE(created_at) = ? AND return_status NOT IN ('VOIDED') AND tenant_id = ?`,
    [settleDate, tenantId],
    tenantId
  );
  const totalRefund = Number(refundRow?.totalRefund ?? 0);

  await queryWithTenant(
    `INSERT INTO daily_settlement (settle_date, total_sales, total_received, total_refund,
       cash_amount, wechat_amount, alipay_amount, transfer_amount, other_amount, operator_id, created_at, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [settleDate, totalSales, totalReceived, totalRefund,
     cashAmount, wechatAmount, alipayAmount, transferAmount, otherAmount,
     operatorId, tenantId],
    tenantId
  );

  return {
    settleDate,
    totalSales,
    totalReceived,
    totalRefund,
    cashAmount,
    wechatAmount,
    alipayAmount,
    transferAmount,
    otherAmount,
    message: "日结成功"
  };
}

export async function listDailySettlements(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (dateStart) {
    conditions.push("settle_date >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("settle_date <= ?");
    queryParams.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT id, settle_date AS settleDate, total_sales AS totalSales,
            total_received AS totalReceived, total_refund AS totalRefund,
            cash_amount AS cashAmount, wechat_amount AS wechatAmount,
            alipay_amount AS alipayAmount, transfer_amount AS transferAmount,
            other_amount AS otherAmount, operator_id AS operatorId, created_at AS createdAt
     FROM daily_settlement
     ${where}
     ORDER BY settle_date DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM daily_settlement ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getDailySettlementDetail(id: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, settle_date AS settleDate, total_sales AS totalSales,
            total_received AS totalReceived, total_refund AS totalRefund,
            cash_amount AS cashAmount, wechat_amount AS wechatAmount,
            alipay_amount AS alipayAmount, transfer_amount AS transferAmount,
            other_amount AS otherAmount, operator_id AS operatorId, created_at AS createdAt
     FROM daily_settlement WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("日结记录不存在"), { statusCode: 404 });
  }
  return record;
}