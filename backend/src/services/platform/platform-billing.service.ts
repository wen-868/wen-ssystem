import type { ResultSetHeader } from "mysql2/promise";
import { constants } from "../../config/constants";
import { query, queryOne } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/**
 * R101-C4-1 包A：平台级财务对账与账单服务
 *
 * 口径（派单卡 C4-1/包A + C4-0 凌舟裁定）：
 * 1. 全平台级：本文件所有函数不接收 `req.tenantId`（`requirePlatformAuth` 不注入该字段，恒 undefined，
 *    见 S3-86/S3-91）。租户身份只来自**请求参数**（body/query）+ 库表校验。
 * 2. 日对账口径 = 平台级：以 `t_platform_reconciliation` 的 `(platform, reconciliation_date)` 唯一键为真相，
 *    `tenant_id` 不作为过滤或写入依据（该表的租户列语义待 S3-91 收口）。
 * 3. 金额单位与精度：`t_platform_settlement` / `t_platform_reconciliation` 金额列均为 `DECIMAL(12,2)`
 *    ⇒ 元、2 位小数；mysql2 对 DECIMAL 返回字符串，本文件统一在出口转 number（避免前端 `"1.00"` 参与运算）。
 * 4. 零假数据：无数据一律空数组，绝不造数；缺失的数据源以 `note`/`amountSource` 显式声明。
 */

/** 金额单位（响应体显式带出，前端不得自行猜） */
export const AMOUNT_UNIT = "CNY";
/** 金额小数位数（元，2 位） */
export const AMOUNT_SCALE = 2;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * DATE/DATETIME 列格式化。
 * 依据：mysql2 未开启 `dateStrings`，DATE/DATETIME 返回 `Date` 对象，且按连接时区构造；
 * 用本地分量取值（而非 `toISOString`）可避免「库里 2026-09-01 渲染成 2026-08-31」的跨天偏移。
 */
function formatDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function formatDateTime(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return (
      `${formatDate(value)} ` +
      `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
    );
  }
  return String(value);
}

/** DECIMAL(12,2) 出口归一：字符串 → number，非法/空 → 0 */
function toAmount(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** 金额保留 2 位（税额等计算结果的落库口径） */
export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 读取 INSERT 的新增主键。
 * 依据 `shared/db.ts`（转发 `config/database.ts:97 query()`）的两套返回形态：
 * - 真实库：`const [rows] = await pool.query(...)` 对写语句得到 `ResultSetHeader` 对象本身 ⇒ `insertId` 在顶层；
 * - `USE_MOCK_DB=true`：mock 分支返回 `[execResult[0]]` 数组 ⇒ `insertId` 在 `[0]`。
 * 这里两种都兜住（单测 mock 返回的是对象形态，走第一条分支）。
 */
function readInsertId(result: unknown): number {
  const direct = (result as ResultSetHeader | undefined)?.insertId;
  const wrapped = (result as [ResultSetHeader] | undefined)?.[0]?.insertId;
  return Number(direct ?? wrapped ?? 0);
}

// ==================================================================
// A-1 日对账列表（GET /api/platform/billing/reconciliation-daily）
// ==================================================================

export interface DailyReconciliationRow {
  id: number;
  platform: string;
  date: string;
  platformOrderCount: number;
  platformAmount: number;
  systemOrderCount: number;
  systemAmount: number;
  diffCount: number;
  diffAmount: number;
  commissionAmount: number | null;
  status: string;
  updatedAt: string;
}

/** 库内原始行（别名与 SELECT 一致；DECIMAL / DATE 类型为 unknown，出库后再归一） */
interface RawDailyRow {
  id: unknown;
  platform: string;
  reconciliationDate: unknown;
  platformOrderCount: unknown;
  platformAmount: unknown;
  systemOrderCount: unknown;
  systemAmount: unknown;
  diffCount: unknown;
  diffAmount: unknown;
  commissionAmount: unknown;
  status: string;
  updatedAt: unknown;
}

function toDailyRow(row: RawDailyRow): DailyReconciliationRow {
  return {
    id: Number(row.id),
    platform: row.platform,
    date: formatDate(row.reconciliationDate),
    platformOrderCount: Number(row.platformOrderCount ?? 0),
    platformAmount: toAmount(row.platformAmount),
    systemOrderCount: Number(row.systemOrderCount ?? 0),
    systemAmount: toAmount(row.systemAmount),
    diffCount: Number(row.diffCount ?? 0),
    diffAmount: toAmount(row.diffAmount),
    commissionAmount: row.commissionAmount == null ? null : toAmount(row.commissionAmount),
    status: row.status,
    updatedAt: formatDateTime(row.updatedAt),
  };
}

/** 日对账查询条件（全部来自请求参数，平台级） */
export interface DailyReconciliationFilter {
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  platform?: string;
}

export interface DailyReconciliationListParams extends DailyReconciliationFilter {
  page: number;
  pageSize: number;
}

const DAILY_SELECT_COLUMNS = `id, platform, reconciliation_date AS reconciliationDate,
       platform_order_count AS platformOrderCount, platform_amount AS platformAmount,
       system_order_count AS systemOrderCount, system_amount AS systemAmount,
       diff_count AS diffCount, diff_amount AS diffAmount,
       commission_amount AS commissionAmount, status, updated_at AS updatedAt`;

function buildDailyWhere(filter: DailyReconciliationFilter): { where: string; values: unknown[] } {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];

  if (filter.dateStart) {
    conditions.push("reconciliation_date >= ?");
    values.push(filter.dateStart);
  }
  if (filter.dateEnd) {
    conditions.push("reconciliation_date <= ?");
    values.push(filter.dateEnd);
  }
  if (filter.status) {
    conditions.push("status = ?");
    values.push(filter.status);
  }
  if (filter.platform) {
    conditions.push("platform = ?");
    values.push(filter.platform);
  }

  return { where: conditions.join(" AND "), values };
}

/** A-1：平台级日对账分页列表（无数据 ⇒ records: []） */
export async function listDailyReconciliations(params: DailyReconciliationListParams) {
  const { where, values } = buildDailyWhere(params);
  const offset = (params.page - 1) * params.pageSize;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_reconciliation WHERE ${where}`,
    values
  );
  const records = await query<RawDailyRow>(
    `SELECT ${DAILY_SELECT_COLUMNS}
     FROM t_platform_reconciliation
     WHERE ${where}
     ORDER BY reconciliation_date DESC, platform ASC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    records: (Array.isArray(records) ? records : []).map(toDailyRow),
  };
}

/** A-2/A-5：导出用（按区间 + 平台，上限 `constants.MAX_EXPORT_LIMIT`，不做无界导出） */
export async function listDailyReconciliationsForExport(filter: DailyReconciliationFilter) {
  const { where, values } = buildDailyWhere(filter);
  const records = await query<RawDailyRow>(
    `SELECT ${DAILY_SELECT_COLUMNS}
     FROM t_platform_reconciliation
     WHERE ${where}
     ORDER BY reconciliation_date ASC, platform ASC
     LIMIT ?`,
    [...values, constants.MAX_EXPORT_LIMIT]
  );
  return (Array.isArray(records) ? records : []).map(toDailyRow);
}

// ==================================================================
// A-3 差异明细（GET /api/platform/billing/reconciliation-daily/:date/diff）
// ==================================================================

export interface DailyDiffSummary {
  /** 当日对账行数（0 表示当日无对账记录） */
  rowCount: number;
  diffCount: number;
  diffAmount: number;
}

/**
 * A-3：当日差异**聚合**读数（逐笔明细库内无载体）。
 * `t_platform_reconciliation` 只有 `diff_count` / `diff_amount` 聚合列，
 * 没有差异明细表（C4-0 裁定本轮不批新表）⇒ 不返回逐笔行，绝不造数。
 */
export async function summarizeDailyReconciliation(date: string): Promise<DailyDiffSummary> {
  const row = await queryOne<{ rowCount: unknown; diffCount: unknown; diffAmount: unknown }>(
    `SELECT COUNT(*) AS rowCount,
            IFNULL(SUM(diff_count), 0) AS diffCount,
            IFNULL(SUM(diff_amount), 0) AS diffAmount
     FROM t_platform_reconciliation
     WHERE reconciliation_date = ?`,
    [date]
  );

  return {
    rowCount: Number(row?.rowCount ?? 0),
    diffCount: Number(row?.diffCount ?? 0),
    diffAmount: toAmount(row?.diffAmount),
  };
}

// ==================================================================
// A-4 手动生成账单（POST /api/platform/billing/generate）
// ==================================================================

/**
 * 生成原因留痕（写入 `t_platform_settlement.remark`）。
 * 依据 C4-0 §十一 A11：订阅/增值计费引擎未落地（`config/api-billing.ts` ENABLED=false）
 * ⇒ 本端点只登记账期与幂等关系，**金额不得凭空编造**，一律 0.00 并在响应里显式声明
 * `amountSource: "UNAVAILABLE"`，待计费引擎接入后由后续任务回填。
 */
const GENERATE_REMARK =
  "C4-1 手动生成：金额来源（订阅/增值计费引擎）未落地（C4-0 §十一 A11），本单金额为 0.00 待回填；本条不做业务金额声明";

export const AMOUNT_SOURCE_UNAVAILABLE = "UNAVAILABLE";
export const AMOUNT_SOURCE_UNAVAILABLE_NOTE =
  "金额来源未落地：订阅/增值计费引擎未启用（C4-0 §十一 A11），本次生成只登记账期，total_amount 固定 0.00 且不参与结算口径；不得据此认定租户已结清";

/** 幂等命中判定（应用层实现；该表无 (tenant_id, period_start, period_end) 唯一键，且禁止 ALTER 既有表） */
const FIND_SETTLEMENT_SQL = `SELECT id, settlement_no AS settlementNo
   FROM t_platform_settlement
   WHERE tenant_id = ? AND period_start = ? AND period_end = ? AND status <> 'CANCELLED'
   ORDER BY id ASC
   LIMIT 1`;

const INSERT_SETTLEMENT_SQL = `INSERT INTO t_platform_settlement
   (settlement_no, tenant_id, period_start, period_end,
    total_amount, pending_amount, status, remark, created_by)
   VALUES (?, ?, ?, ?, 0.00, 0.00, 'PENDING', ?, 'system')`;

export interface SettlementGenerationInput {
  periodStart: string;
  periodEnd: string;
  /** 未传或空数组 ⇒ 全租户（读 t_tenant；平台级操作） */
  tenantIds?: string[];
}

export interface SettlementGenerationItem {
  tenantId: string;
  settlementId: number;
  settlementNo: string;
  /** true = 命中既有单（同账期复用），false = 本次新建 */
  idempotent: boolean;
}

export interface SettlementGenerationResult {
  periodStart: string;
  periodEnd: string;
  created: number;
  reused: number;
  amountSource: typeof AMOUNT_SOURCE_UNAVAILABLE;
  note: string;
  records: SettlementGenerationItem[];
}

/** 全租户清单（仅取主键，避免依赖 t_tenant 的其它列——该表存在历史双定义，见 S3-86/S3-91） */
async function listAllTenantIds(): Promise<string[]> {
  const rows = await query<{ id: unknown }>("SELECT id FROM t_tenant ORDER BY id ASC");
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.id ?? "").trim())
    .filter((id) => id.length > 0);
}

/**
 * 单租户单账期：先查 → 命中即复用 → 未命中才 INSERT → INSERT 后再查一次兜住并发
 * （并发已插入则返回先插的那份，`idempotent: true`）。
 */
async function generateOneSettlement(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<SettlementGenerationItem> {
  const existing = await queryOne<{ id: unknown; settlementNo: string }>(FIND_SETTLEMENT_SQL, [
    tenantId,
    periodStart,
    periodEnd,
  ]);
  if (existing) {
    return {
      tenantId,
      settlementId: Number(existing.id),
      settlementNo: existing.settlementNo,
      idempotent: true,
    };
  }

  const settlementNo = makeBizNo("SET");
  const insertResult = await query(INSERT_SETTLEMENT_SQL, [
    settlementNo,
    tenantId,
    periodStart,
    periodEnd,
    GENERATE_REMARK,
  ]);
  const insertId = readInsertId(insertResult);

  const winner = await queryOne<{ id: unknown; settlementNo: string }>(FIND_SETTLEMENT_SQL, [
    tenantId,
    periodStart,
    periodEnd,
  ]);
  if (winner && Number(winner.id) !== insertId) {
    return {
      tenantId,
      settlementId: Number(winner.id),
      settlementNo: winner.settlementNo,
      idempotent: true,
    };
  }

  return { tenantId, settlementId: insertId, settlementNo, idempotent: false };
}

/** A-4：按账期生成/复用结算单（幂等） */
export async function generateSettlements(
  input: SettlementGenerationInput
): Promise<SettlementGenerationResult> {
  const tenantIds =
    input.tenantIds && input.tenantIds.length > 0 ? input.tenantIds : await listAllTenantIds();

  const records: SettlementGenerationItem[] = [];
  for (const tenantId of tenantIds) {
    records.push(await generateOneSettlement(tenantId, input.periodStart, input.periodEnd));
  }

  const reused = records.filter((item) => item.idempotent).length;
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    created: records.length - reused,
    reused,
    amountSource: AMOUNT_SOURCE_UNAVAILABLE,
    note: AMOUNT_SOURCE_UNAVAILABLE_NOTE,
    records,
  };
}

// ==================================================================
// A-6 开票申请（POST /api/platform/billing/invoice，复用 t_invoice）
// ==================================================================

/** 平台开给租户的销项票（t_invoice.invoice_type 取值域 IN/OUT，见 068_银行费用发票.sql） */
export const PLATFORM_INVOICE_TYPE = "OUT";
/** 关联业务类型（t_invoice.related_type） */
export const PLATFORM_INVOICE_RELATED_TYPE = "PLATFORM_BILLING";
/** 申请即写 PENDING，绝不伪造 ISSUED */
export const PLATFORM_INVOICE_STATUS = "PENDING";

export interface InvoiceCreateInput {
  tenantId: string;
  settlementNo?: string;
  settlementId?: number;
  amount?: number;
  taxRate?: number;
  invoiceType?: string;
}

export interface InvoiceSettlementRow {
  id: unknown;
  settlementNo: string;
  tenantId: string;
  totalAmount: unknown;
}

export interface InvoiceCreateResult {
  invoiceNo: string;
  invoiceType: string;
  relatedType: string;
  relatedNo: string | null;
  status: string;
  tenantId: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  settlementId: number;
  settlementNo: string;
}

function businessError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/** 租户是否存在（平台级校验：租户身份来自请求参数，不读 req.tenantId；S3-86/S3-91） */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const row = await queryOne<{ id: unknown }>("SELECT id FROM t_tenant WHERE id = ?", [tenantId]);
  return !!row;
}

/**
 * 开票关联的结算单解析（优先级：settlementId > settlementNo > 该租户最近一单）。
 * 一律带 `tenant_id = ?` 限租户，避免跨租户开票。
 */
export async function findSettlementForInvoice(
  input: InvoiceCreateInput
): Promise<InvoiceSettlementRow | null> {
  const columns = `id, settlement_no AS settlementNo, tenant_id AS tenantId, total_amount AS totalAmount`;

  if (input.settlementId !== undefined) {
    return queryOne<InvoiceSettlementRow>(
      `SELECT ${columns} FROM t_platform_settlement WHERE id = ? AND tenant_id = ?`,
      [input.settlementId, input.tenantId]
    );
  }
  if (input.settlementNo) {
    return queryOne<InvoiceSettlementRow>(
      `SELECT ${columns} FROM t_platform_settlement WHERE settlement_no = ? AND tenant_id = ?`,
      [input.settlementNo, input.tenantId]
    );
  }
  return queryOne<InvoiceSettlementRow>(
    `SELECT ${columns} FROM t_platform_settlement
     WHERE tenant_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [input.tenantId]
  );
}

/**
 * A-6：开票申请（复用 `t_invoice`，零 ALTER、零新表）。
 * 业务规则：租户不存在 ⇒ 404；租户无可用结算单 ⇒ 400；金额缺省取结算单 total_amount（不得凭空造金额）。
 */
export async function createInvoice(input: InvoiceCreateInput): Promise<InvoiceCreateResult> {
  if (!(await tenantExists(input.tenantId))) {
    throw businessError("租户不存在", 404);
  }

  const settlement = await findSettlementForInvoice(input);
  if (!settlement) {
    throw businessError("该租户无可用结算单，无法确定开票金额（请先按账期生成账单）", 400);
  }

  const amount = input.amount !== undefined ? roundAmount(input.amount) : roundAmount(toAmount(settlement.totalAmount));
  const taxRate = input.taxRate ?? 0;
  const taxAmount = roundAmount(amount * taxRate);
  const invoiceType = input.invoiceType || PLATFORM_INVOICE_TYPE;
  const invoiceNo = makeBizNo("INV");

  await query(
    `INSERT INTO t_invoice
     (invoice_no, invoice_type, related_type, related_no, amount, tax_rate, tax_amount, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceNo,
      invoiceType,
      PLATFORM_INVOICE_RELATED_TYPE,
      settlement.settlementNo || null,
      amount,
      taxRate,
      taxAmount,
      PLATFORM_INVOICE_STATUS,
      input.tenantId,
    ]
  );

  return {
    invoiceNo,
    invoiceType,
    relatedType: PLATFORM_INVOICE_RELATED_TYPE,
    relatedNo: settlement.settlementNo || null,
    status: PLATFORM_INVOICE_STATUS,
    tenantId: input.tenantId,
    amount,
    taxRate,
    taxAmount,
    settlementId: Number(settlement.id),
    settlementNo: settlement.settlementNo,
  };
}
