import { query, queryOne } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { AppError } from "../../shared/app-error";

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

/**
 * 交接班「班次类型」口径（S3-145 新增）
 *
 * 背景：`t_shift` 表**没有** `shift_type` 列（见 `docs/migrations/148_shift_stock_check.sql`：
 * 该表列为 id/tenant_id/shift_no/store_id/operator_id/operator_name/start_time/end_time/
 * status/opening_cash/remark/created_at/updated_at）。因此「班次类型」不落库，
 * 只能在**读侧**按开始时间派生。
 *
 * 本函数是**唯一口径**：交接班列表（展示 + 筛选）与交接班详情徽标共用它，
 * 避免"列表一个值、详情一个值"的不一致（原 `getShiftDetail` 硬编码 `shiftType: "DAY"`，
 * 与列表筛选项 MORNING/AFTERNOON/EVENING 对不上）。
 *
 * 规则：< 12:00 早班 MORNING；12:00–17:59 中班 AFTERNOON；>= 18:00 晚班 EVENING。
 * ⚠ 这是**派生值**，不是用户创建时选择的班次类型；若要"用户指定班次类型"，须给
 * `t_shift` 增列 `shift_type`（DDL，属本单红线外，已在 S3-145 回传卡中申请）。
 */
export function deriveShiftType(startTime: Date | string | null | undefined): string {
  const hour = shiftStartHour(startTime);
  if (hour === null) return "";
  if (hour < 12) return "MORNING";
  if (hour < 18) return "AFTERNOON";
  return "EVENING";
}

/** 取开始时间的小时数：字符串优先按字面量取，避免 ISO 串按 UTC 换算造成时区偏移 */
function shiftStartHour(startTime: Date | string | null | undefined): number | null {
  if (typeof startTime === "string") {
    const matched = startTime.match(/[T ](\d{1,2}):/);
    if (matched) return Number(matched[1]);
  }
  const date = startTime instanceof Date ? startTime : new Date(String(startTime ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.getHours();
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

/**
 * 创建交接班（OPEN，落 t_shift 表）
 *
 * S3-145：补上原先被静默忽略的创建入参——
 *  · startTime：用户选定的开始时间（原实现恒取 DB 默认 CURRENT_TIMESTAMP，
 *    前端"开始时间"填了也不生效）；
 *  · operatorName：由 controller 按"用户填写优先、登录用户兜底"解析后传入。
 *  · shiftType：`t_shift` 无 `shift_type` 列（见 `docs/migrations/148_shift_stock_check.sql`），
 *    **仍然无法落库**；列表/详情按 `deriveShiftType(start_time)` 读侧派生，
 *    要"用户指定班次类型"须增列（DDL，已在 S3-145 回传卡中作为申请项上报）。
 */
export async function createShift(
  tenantId: string,
  storeId: number,
  operatorId: number,
  operatorName: string,
  body: { startTime?: string; openingCash?: number; remark?: string }
) {
  const shiftNo = makeBizNo("JB");
  // 前端 value-format 为 "YYYY-MM-DD HH:mm:ss"。
  // 注意：这里**按字符串入库**（不是 JS Date）——连接池 `timezone: "Z"` 会把 Date 先转 UTC 再落库，
  // 用户填的 20:15 会变成 12:15；传字符串则按字面量落 DATETIME，与用户所填一致。
  // 未传/非法时交给 DB 默认 CURRENT_TIMESTAMP。
  const startTime = normalizeStartTime(body.startTime);
  const insert = (await query(
    `INSERT INTO t_shift (tenant_id, shift_no, store_id, operator_id, operator_name, start_time, opening_cash, remark)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)`,
    [
      tenantId, shiftNo, storeId, operatorId || null, operatorName || null,
      startTime, body.openingCash ?? 0, body.remark || null
    ]
  )) as unknown as { insertId: number };
  return {
    id: insert.insertId,
    shiftNo,
    shiftType: deriveShiftType(startTime),
    startTime: startTime ?? new Date().toISOString(),
    status: "OPEN",
    operatorId,
    operatorName: operatorName || "",
    openingCash: body.openingCash ?? 0,
    remark: body.remark || "",
  };
}

/** 校验并归一化"用户填写的开始时间"（YYYY-MM-DD HH:mm[:ss]）；非法值返回 null（回落 DB 默认） */
function normalizeStartTime(value?: string): string | null {
  if (!value) return null;
  const matched = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(String(value).trim());
  if (!matched) return null;
  return `${matched[1]} ${matched[2]}:${matched[3] ?? "00"}`;
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

/**
 * 交接班列表（S3-145 新增只读端点 GET /api/store/shifts 的服务实现）
 *
 * 与详情/统计/盘点**同源**：都读 `t_shift`。
 * 修复根因：原交接班列表走 `getShiftHistory`（读 `t_daily_settlement`，单号 BJ…），
 * 而详情/统计走 `t_shift`（单号 JB…），两者编号空间不相交 ⇒ 列表行点进详情恒业务级 404。
 * `/store/shift/history`（t_daily_settlement）**保留"班结历史"语义**，不再承担交接班列表。
 */
export async function getShiftList(
  tenantId: string,
  storeId: number,
  params: { page: number; pageSize: number; date?: string; shiftType?: string }
) {
  const page = params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize > 0 ? params.pageSize : 20;

  const conditions = ["tenant_id = ?", "store_id = ?"];
  const args: unknown[] = [tenantId, storeId];
  if (params.date) {
    conditions.push("DATE(start_time) = ?");
    args.push(params.date);
  }
  const rows = await query<ShiftRow>(
    `SELECT id, shift_no AS shiftNo, store_id AS storeId, operator_id AS operatorId,
            operator_name AS operatorName, start_time AS startTime, end_time AS endTime,
            status, opening_cash AS openingCash, remark
     FROM t_shift
     WHERE ${conditions.join(" AND ")}
     ORDER BY start_time DESC, id DESC`,
    args
  );

  // 班次类型是读侧派生值（t_shift 无 shift_type 列），故按派生值与展示同一口径筛选、分页，
  // 保证"筛选条件"与"列表里看到的班次"永不互相打架（单店班次记录量小，内存筛选可接受）。
  const filtered = params.shiftType
    ? rows.filter((row) => deriveShiftType(row.startTime) === params.shiftType)
    : rows;
  const total = filtered.length;
  const offset = (page - 1) * pageSize;
  const pageRows = filtered.slice(offset, offset + pageSize);

  const records = [];
  for (const row of pageRows) {
    const sales = await getShiftPeriodSales(
      tenantId,
      row.storeId,
      new Date(row.startTime),
      row.endTime ? new Date(row.endTime) : null
    );
    records.push({
      id: row.id,
      shiftNo: row.shiftNo,
      shiftType: deriveShiftType(row.startTime),
      storeId: row.storeId,
      operatorId: row.operatorId,
      operatorName: row.operatorName || "",
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      openingCash: Number(row.openingCash ?? 0),
      remark: row.remark || "",
      totalSalesAmount: Number(sales.totalAmount ?? 0),
      totalOrders: Number(sales.totalCount ?? 0),
    });
  }
  return { records, total, page, pageSize };
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
    // 与列表/筛选同一口径（读侧派生；t_shift 无 shift_type 列，见 deriveShiftType 说明）
    shiftType: deriveShiftType(row.startTime),
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

/**
 * 关闭交接班（S3-146：把「完成交接」从"按钮摆着但不写库"变成**真能关闭**）
 *
 * 语义（钉死，与详情端点同口径）：
 *  · 范围：**该租户该门店**的 `t_shift`（跨门店单号与不存在同样按业务级 404 处理，不透出其它门店数据）；
 *  · 动作：`status: OPEN → CLOSED`，并落 `end_time`——**一律取服务端时间**（不接受前端传值）；
 *  · 未知 shiftNo ⇒ 业务级 **404**（沿用 getShiftRow 的「交接班不存在」）；
 *  · 已 CLOSED 再调 ⇒ **显式业务结果**（HTTP 409 + 文案「交接班已完成，无需重复关闭」）：
 *    既不做静默 200 假成功，也不把数据库错误泄露出去；
 *  · 并发保护：UPDATE 带 `status <> 'CLOSED'` 条件并**校验 affectedRows**（S3-65 教训：写操作
 *    0 行 ≠ 改成功），为 0 时按"已被并发关闭"返回同一 409 结果。
 *
 * 说明：`t_shift.status` 取值域当前为 `OPEN`/`CLOSED`（DDL 默认 `OPEN`，本单**不得**改动取值域），
 * 故 `status <> 'CLOSED'` 等价于「未完成」。
 */
export async function closeShift(tenantId: string, storeId: number, shiftNo: string) {
  const row = await getShiftRow(tenantId, shiftNo);
  if (Number(row.storeId) !== Number(storeId)) {
    throw new AppError("交接班不存在", 404);
  }
  if (String(row.status || "").toUpperCase() === "CLOSED") {
    throw new AppError("交接班已完成，无需重复关闭", 409);
  }

  const writeResult = (await query(
    `UPDATE t_shift
      SET status = 'CLOSED', end_time = NOW()
      WHERE shift_no = ? AND tenant_id = ? AND status <> 'CLOSED'`,
    [shiftNo, tenantId]
  )) as unknown as { affectedRows?: number } | Array<{ affectedRows?: number }>;
  // 真实库返回 ResultSetHeader（对象）；dev mock 归一化为 [header]（数组）——两种形状都取 affectedRows
  const affectedRows = Number(
    (writeResult as { affectedRows?: number })?.affectedRows ??
      (Array.isArray(writeResult) ? writeResult[0]?.affectedRows : 0) ??
      0
  );
  if (affectedRows === 0) {
    throw new AppError("交接班已完成，无需重复关闭", 409);
  }

  // 回读详情：把落库后的 status / end_time（服务端时间）如实回给调用方，便于前端与验收直接核对
  return getShiftDetail(tenantId, shiftNo);
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
