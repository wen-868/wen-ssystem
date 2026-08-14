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
      shiftData.paymentBreakdown.find((b) => b.channel === "CASH")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b) => b.channel === "WECHAT")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b) => b.channel === "ALIPAY")?.amount ?? 0,
      shiftData.paymentBreakdown.find((b) => b.channel === "TRANSFER")?.amount ?? 0,
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

// ==================== R100-04 交接班（创建/详情/统计/盘点） ====================

/** 交接班记录行 */
interface ShiftRow {
  id: number;
  shiftNo: string;
  storeId: number;
  operatorId: number | null;
  operatorName: string | null;
  startTime: Date | string;
  endTime: Date | string | null;
  status: string;
  openingCash: number | string;
  remark: string | null;
}

/** 指定时间段销售统计（与 getCurrentShift 统计口径一致） */
async function getShiftPeriodSales(tenantId: string, storeId: number, startTime: Date, endTime: Date | null) {
  const end = endTime ?? new Date();
  const salesRow = await queryOne<SalesStatsRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalSales,
            COUNT(*) AS orderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CASH' THEN 1 ELSE 0 END), 0) AS cashOrderCount,
            COALESCE(SUM(CASE WHEN sale_type = 'CREDIT' THEN 1 ELSE 0 END), 0) AS creditOrderCount
     FROM t_sale_bill
     WHERE store_id = ? AND tenant_id = ?
       AND created_at >= ? AND created_at <= ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId, startTime, end]
  );
  const returnRow = await queryOne<ReturnStatsRow>(
    `SELECT COALESCE(COUNT(*), 0) AS returnOrderCount
     FROM t_sale_return
     WHERE tenant_id = ?
       AND created_at >= ? AND created_at <= ?`,
    [tenantId, startTime, end]
  );
  const receivedRow = await queryOne<ReceivedStatsRow>(
    `SELECT COALESCE(SUM(amount), 0) AS totalReceived
     FROM t_payment_order
     WHERE tenant_id = ?
       AND paid_at >= ? AND paid_at <= ?
       AND status = 'SUCCESS'`,
    [tenantId, startTime, end]
  );
  const channelRows = await query<PaymentChannelRow>(
    `SELECT channel, COALESCE(SUM(amount), 0) AS amount
     FROM t_payment_order
     WHERE tenant_id = ?
       AND paid_at >= ? AND paid_at <= ?
       AND status = 'SUCCESS'
     GROUP BY channel`,
    [tenantId, startTime, end]
  );
  const totalAmount = Number(salesRow?.totalSales ?? 0);
  return {
    totalAmount,
    totalCount: Number(salesRow?.orderCount ?? 0),
    cashAmount: channelRows.find((b) => b.channel === "CASH")?.amount ?? 0,
    wechatAmount: channelRows.find((b) => b.channel === "WECHAT")?.amount ?? 0,
    alipayAmount: channelRows.find((b) => b.channel === "ALIPAY")?.amount ?? 0,
    totalReceived: Number(receivedRow?.totalReceived ?? 0),
    returnOrderCount: Number(returnRow?.returnOrderCount ?? 0),
    paymentBreakdown: channelRows.map((r) => ({ channel: r.channel, amount: Number(r.amount) })),
  };
}

/** 创建交接班（OPEN，落 t_shift 表） */
export async function createShift(
  tenantId: string,
  storeId: number,
  operatorId: number,
  operatorName: string,
  body: { openingCash?: number; remark?: string }
) {
  const shiftNo = makeBizNo("JB");
  const insert = (await query(
    `INSERT INTO t_shift (tenant_id, shift_no, store_id, operator_id, operator_name, opening_cash, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, shiftNo, storeId, operatorId || null, operatorName || null, body.openingCash ?? 0, body.remark || null]
  )) as unknown as { insertId: number };
  return {
    id: insert.insertId,
    shiftNo,
    shiftType: "DAY",
    startTime: new Date().toISOString(),
    status: "OPEN",
    operatorId,
    operatorName: operatorName || "",
    openingCash: body.openingCash ?? 0,
    remark: body.remark || "",
  };
}

async function getShiftRow(tenantId: string, shiftNo: string): Promise<ShiftRow> {
  const row = await queryOne<ShiftRow>(
    `SELECT id, shift_no AS shiftNo, store_id AS storeId, operator_id AS operatorId,
            operator_name AS operatorName, start_time AS startTime, end_time AS endTime,
            status, opening_cash AS openingCash, remark
     FROM t_shift
     WHERE shift_no = ? AND tenant_id = ?`,
    [shiftNo, tenantId]
  );
  if (!row) {
    throw Object.assign(new Error("交接班不存在"), { statusCode: 404 });
  }
  return row;
}

/** 交接班详情（含本班次销售统计） */
export async function getShiftDetail(tenantId: string, shiftNo: string) {
  const row = await getShiftRow(tenantId, shiftNo);
  const sales = await getShiftPeriodSales(
    tenantId,
    row.storeId,
    new Date(row.startTime),
    row.endTime ? new Date(row.endTime) : null
  );
  return {
    id: row.id,
    shiftNo: row.shiftNo,
    shiftType: "DAY",
    storeId: row.storeId,
    operatorId: row.operatorId,
    operatorName: row.operatorName || "",
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    openingCash: Number(row.openingCash),
    remark: row.remark || "",
    ...sales,
  };
}

/** 交接班销售统计 */
export async function getShiftSalesStats(tenantId: string, shiftNo: string) {
  const row = await getShiftRow(tenantId, shiftNo);
  return getShiftPeriodSales(
    tenantId,
    row.storeId,
    new Date(row.startTime),
    row.endTime ? new Date(row.endTime) : null
  );
}

/** 交接班盘点：返回当前门店库存快照（账面数量） */
export async function getShiftStockCheck(tenantId: string, storeId: number) {
  const rows = await query(
    `SELECT ib.sku_id AS skuId, sku.sku_name AS skuName, spu.name AS productName,
            spu.specs AS spec, ib.available_qty AS bookQty
     FROM t_inventory_balance ib
     JOIN t_product_sku sku ON sku.id = ib.sku_id
     JOIN t_product_spu spu ON spu.id = sku.spu_id
     WHERE ib.store_id = ? AND ib.tenant_id = ?
     ORDER BY spu.name, sku.sku_name`,
    [storeId, tenantId]
  );
  return {
    records: rows.map((r: any) => ({
      skuId: r.skuId,
      skuName: r.skuName || "",
      productName: r.productName || "",
      spec: r.spec || "",
      bookQty: Number(r.bookQty ?? 0),
      actualQty: Number(r.bookQty ?? 0),
    })),
  };
}

/** 提交交接班盘点：明细写入 t_shift_stock_check（留痕，不调整库存） */
export async function submitShiftStockCheck(
  tenantId: string,
  shiftNo: string,
  items: Array<{ skuId: number; bookQty?: number; actualQty: number; diffReason?: string }>
) {
  const row = await getShiftRow(tenantId, shiftNo);
  let diffCount = 0;
  for (const item of items) {
    const expectedQty = Number(item.bookQty ?? 0);
    const actualQty = Number(item.actualQty ?? 0);
    const diffQty = actualQty - expectedQty;
    if (diffQty !== 0) diffCount += 1;
    await query(
      `INSERT INTO t_shift_stock_check
        (tenant_id, shift_no, sku_id, expected_qty, actual_qty, diff_qty, diff_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        expected_qty = VALUES(expected_qty), actual_qty = VALUES(actual_qty),
        diff_qty = VALUES(diff_qty), diff_reason = VALUES(diff_reason)`,
      [tenantId, shiftNo, item.skuId, expectedQty, actualQty, diffQty, item.diffReason || null]
    );
  }
  return { shiftNo: row.shiftNo, count: items.length, diffCount };
}
