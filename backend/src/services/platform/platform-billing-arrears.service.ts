import { query, queryOne } from "../../shared/db";
import { sendNotification } from "../admin/notification.service";
import { AMOUNT_SCALE, AMOUNT_UNIT } from "./platform-billing.service";
import { getArrearsPolicy } from "./billing-config.service";

/**
 * R101-C4-1b 段一（包B）：平台级欠费与增值扣费流水服务
 *
 * 口径（派单卡 C4-1b §二.段一）：
 * 1. **全平台级**：本文件不接收 `req.tenantId`（`requirePlatformAuth` 不注入该字段，
 *    见踩坑日志 [35]、S3-86/S3-91）；租户身份只来自请求参数 + 库表校验。
 * 2. **零 DDL（除 176 新表）**：
 *    - 欠费清单/催缴复用 `t_platform_settlement`（`docs/migrations/124_drift_tables_fill.sql:146-160`）
 *      + `t_tenant`（`016_phase9_tenant_subscription.sql:10-39`，名称列 `152_business_columns_fill.sql:32`）；
 *    - 增值扣费流水读 176 新建的 `t_platform_addon_charge`（草案 A1，见 C4-0 清账 §八）；
 *    - 调用量日统计**一律复用** C3 的 `t_open_api_call_daily`，本文件不建同义表。
 * 3. **零假数据**：无数据一律空数组；金额缺载体时返回 `null`，绝不填 0 冒充。
 * 4. **站内单通道**：催缴只写 `t_notification`（复用 `services/admin/notification.service.ts`），
 *    **不接任何短信/邮件/微信通道**（短信属阶段三，需外部凭据）。
 */

/** 金额单位（响应体显式带出，前端不得自行猜） */
export const ARREARS_AMOUNT_UNIT = AMOUNT_UNIT;
/** 金额小数位数（元，2 位） */
export const ARREARS_AMOUNT_SCALE = AMOUNT_SCALE;

/* ==================================================================
 * 一、欠费处理阶段（stage）
 * ==================================================================
 *
 * stage 是**派生值**（不是库内列）：由「欠费天数 D」与欠费处理策略的 4 段边界共同决定。
 * 依据 `schemas/billing.schema.ts` 的 arrearsPolicySchema 注释（设计稿 v1.6 第 809 行时间线）：
 *   宽限期(全功能) → 功能降级·只读 → 冻结·仅可导出 → 保留期 → 注销清除
 * 欠费起始日 D+0 = 结算单账期结束日（`t_platform_settlement.period_end`），D = 今日 - period_end。
 *
 * 护栏④（与 S2-02 组2 同口径）：策略未配置时**不得回落任何内置默认天数**
 * ⇒ stage/nextAction 一律为 `null`，并以 `stageNote` 说明原因。
 */

export const STAGE_GRACE = "宽限期";
export const STAGE_DEGRADE = "功能降级";
export const STAGE_FROZEN = "已冻结";
export const STAGE_RETAIN = "保留期";
export const STAGE_PENDING_CANCEL = "待注销";

export const ARREARS_STAGES = [
  STAGE_GRACE,
  STAGE_DEGRADE,
  STAGE_FROZEN,
  STAGE_RETAIN,
  STAGE_PENDING_CANCEL,
] as const;

export type ArrearsStage = (typeof ARREARS_STAGES)[number];

/**
 * 服务层扫描上限。
 * 理由：stage 是派生值，SQL 无法在策略未配置时可靠过滤 ⇒ 欠费清单在服务层做 stage 过滤与分页；
 * 为避免无界扫描，单次最多扫描 `ARREARS_SCAN_LIMIT` 行，超出时以 `scanLimitReached=true` 显式声明
 * （不得静默截断）。
 */
export const ARREARS_SCAN_LIMIT = 2000;

export interface ArrearsStagePolicy {
  configured: boolean;
  graceEndDays: number | null;
  degradeEndDays: number | null;
  freezeEndDays: number | null;
  retainEndDays: number | null;
  note: string;
}

const POLICY_CONFIGURED_NOTE =
  "处理阶段由欠费处理策略（t_platform_config:billing:arrears_policy）的 4 段边界派生；欠费起始日 D+0 = 账期结束日（period_end）";
const POLICY_UNCONFIGURED_NOTE =
  "欠费处理策略（billing:arrears_policy）未完整配置（需 graceEndDays/degradeEndDays/freezeEndDays/retainEndDays 四段边界齐备）；系统不内置任何默认天数，故 stage 与 nextAction 一律为 null";

/** 读取欠费处理策略（复用 S2-02 组2 的读路径，不另写一套同表 SQL） */
export async function resolveArrearsStagePolicy(): Promise<ArrearsStagePolicy> {
  const pkg = await getArrearsPolicy();
  const pick = (key: string): number | null => {
    const value = pkg[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  };

  const graceEndDays = pick("graceEndDays");
  const degradeEndDays = pick("degradeEndDays");
  const freezeEndDays = pick("freezeEndDays");
  const retainEndDays = pick("retainEndDays");
  const configured =
    graceEndDays !== null &&
    degradeEndDays !== null &&
    freezeEndDays !== null &&
    retainEndDays !== null;

  return {
    configured,
    graceEndDays,
    degradeEndDays,
    freezeEndDays,
    retainEndDays,
    note: configured ? POLICY_CONFIGURED_NOTE : POLICY_UNCONFIGURED_NOTE,
  };
}

/* ==================================================================
 * 二、通用取值归一（与包A platform-billing.service.ts 同口径）
 * ================================================================== */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** DATE/DATETIME 列格式化：用本地分量取值，避免 ISO 转换造成的跨天偏移 */
function formatDateValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

/** DATE/DATETIME 列格式化（含时分秒） */
function formatDateTimeValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return (
      `${formatDateValue(value)} ` +
      `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
    );
  }
  return String(value);
}

/** DECIMAL(12,2) 出口归一：字符串 → number；`null`/空保持 `null`（不填 0 冒充） */
function toNullableAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** DECIMAL(14,2) 用量归一：非法/空 → 0（用量为 0 是真实语义，非造假） */
function toQuantity(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** 今日（YYYY-MM-DD，本地时区）；`today` 仅用于测试注入，生产走 `new Date()` */
function todayString(today?: string): string {
  if (today) return today;
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 日期差（整天数，按 UTC 计算，避免时区/夏令时干扰）；非法日期返回 0 */
function daysBetween(startDate: string, endDate: string): number {
  const parse = (text: string): number | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (start === null || end === null) return 0;
  return Math.round((end - start) / 86400000);
}

/** 处理阶段派生：策略未配置 ⇒ null（绝不回落默认天数） */
export function deriveArrearsStage(
  days: number,
  policy: ArrearsStagePolicy
): ArrearsStage | null {
  const { graceEndDays, degradeEndDays, freezeEndDays, retainEndDays } = policy;
  if (
    graceEndDays === null ||
    degradeEndDays === null ||
    freezeEndDays === null ||
    retainEndDays === null
  ) {
    return null;
  }
  if (days <= graceEndDays) return STAGE_GRACE;
  if (days <= degradeEndDays) return STAGE_DEGRADE;
  if (days <= freezeEndDays) return STAGE_FROZEN;
  if (days <= retainEndDays) return STAGE_RETAIN;
  return STAGE_PENDING_CANCEL;
}

/** 下次动作（同样只由已配置策略派生；未配置 ⇒ null） */
export function deriveNextAction(
  days: number,
  stage: ArrearsStage | null,
  policy: ArrearsStagePolicy
): string | null {
  if (!stage) return null;
  const { graceEndDays, degradeEndDays, freezeEndDays, retainEndDays } = policy;
  switch (stage) {
    case STAGE_GRACE:
      return `D+${graceEndDays} 后功能降级（剩余 ${Number(graceEndDays) - days} 天）`;
    case STAGE_DEGRADE:
      return `D+${degradeEndDays} 后冻结（剩余 ${Number(degradeEndDays) - days} 天）`;
    case STAGE_FROZEN:
      return `D+${freezeEndDays} 后进入保留期（剩余 ${Number(freezeEndDays) - days} 天）`;
    case STAGE_RETAIN:
      return `D+${retainEndDays} 后转人工注销（剩余 ${Number(retainEndDays) - days} 天）`;
    default:
      return `已超保留截止 D+${retainEndDays}，等待人工确认注销`;
  }
}

/* ==================================================================
 * 三、B-1 欠费清单（GET /api/platform/billing/arrears）
 * ================================================================== */

export interface ArrearsListFilter {
  stage?: ArrearsStage;
  keyword?: string;
}

export interface ArrearsListParams extends ArrearsListFilter {
  page: number;
  pageSize: number;
}

/** 欠费行（前端 Tab2「欠费管理」下钻用；行内带 tenantId/tenantName） */
export interface ArrearsRow {
  id: number;
  tenantId: string;
  tenantName: string;
  /** 租户编码（前端行内副标题 tenantSub） */
  tenantSub: string | null;
  billNo: string;
  /** 欠费金额（元 / 2 位小数） */
  amount: number | null;
  /** 欠费天数（今日 - 账期结束日；未到期记 0） */
  days: number;
  stage: ArrearsStage | null;
  stageNote: string | null;
  nextAction: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
}

interface RawArrearsRow {
  id: unknown;
  tenantId: unknown;
  tenantName: unknown;
  tenantSub: unknown;
  billNo: unknown;
  amount: unknown;
  periodStart: unknown;
  periodEnd: unknown;
  status: unknown;
}

/**
 * 欠费口径（诚实声明）：`t_platform_settlement` 中 `status <> 'CANCELLED'` 且
 * `pending_amount > 0`（待结算金额 > 0）的账单。金额一律取 `pending_amount`（元 / 2 位小数），
 * 不推算、不四舍五入后冒充结清。
 */
function toArrearsRow(
  row: RawArrearsRow,
  policy: ArrearsStagePolicy,
  today: string
): ArrearsRow {
  const periodEnd = formatDateValue(row.periodEnd);
  const rawDays = daysBetween(periodEnd, today);
  const days = rawDays > 0 ? rawDays : 0;
  const stage = deriveArrearsStage(days, policy);
  const tenantName = row.tenantName == null ? "" : String(row.tenantName);

  return {
    id: Number(row.id),
    tenantId: row.tenantId == null ? "" : String(row.tenantId),
    tenantName,
    tenantSub: row.tenantSub == null || row.tenantSub === "" ? null : String(row.tenantSub),
    billNo: row.billNo == null ? "" : String(row.billNo),
    amount: toNullableAmount(row.amount),
    days,
    stage,
    stageNote: policy.configured
      ? null
      : `处理阶段未派生：${POLICY_UNCONFIGURED_NOTE}`,
    nextAction: deriveNextAction(days, stage, policy),
    periodStart: formatDateValue(row.periodStart),
    periodEnd,
    status: row.status == null ? "" : String(row.status),
  };
}

/** 业务错误（统一走 error-handler 的 `statusCode` 分支） */
export function arrearsBusinessError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

export interface ArrearsListResult {
  records: ArrearsRow[];
  total: number;
  page: number;
  pageSize: number;
  stagePolicy: ArrearsStagePolicy;
  scanLimit: number;
  scanLimitReached: boolean;
  amountUnit: string;
  amountScale: number;
}

/**
 * B-1：平台级跨租户欠费清单（分页 + stage/keyword 筛选）。
 * 无数据 ⇒ `records: []`（不造数）。
 */
export async function listArrears(
  params: ArrearsListParams,
  options: { today?: string } = {}
): Promise<ArrearsListResult> {
  const policy = await resolveArrearsStagePolicy();

  // stage 过滤依赖已配置策略：未配置时无法派生 stage，直接拒绝而不是"过滤后返回空"（不静默失效）
  if (params.stage && !policy.configured) {
    throw arrearsBusinessError(
      `参数非法：stage=${params.stage} 过滤依赖欠费处理策略（billing:arrears_policy）的 4 段边界，当前策略未完整配置，无法派生 stage；请先配置策略或去掉 stage 参数`,
      400
    );
  }

  const conditions = ["s.status <> 'CANCELLED'", "s.pending_amount > 0"];
  const values: unknown[] = [];

  const keyword = params.keyword?.trim();
  if (keyword) {
    conditions.push(
      "(t.tenant_name LIKE ? OR t.company_name LIKE ? OR s.tenant_name LIKE ? OR s.settlement_no LIKE ?)"
    );
    const like = `%${keyword}%`;
    values.push(like, like, like, like);
  }

  const rows = await query<RawArrearsRow>(
    `SELECT s.id, s.tenant_id AS tenantId,
            COALESCE(NULLIF(s.tenant_name, ''), t.tenant_name, t.company_name) AS tenantName,
            t.tenant_code AS tenantSub,
            s.settlement_no AS billNo, s.pending_amount AS amount,
            s.period_start AS periodStart, s.period_end AS periodEnd, s.status
     FROM t_platform_settlement s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.period_end ASC, s.id ASC
     LIMIT ?`,
    [...values, ARREARS_SCAN_LIMIT + 1]
  );

  const scannedAll = Array.isArray(rows) ? rows : [];
  const scanLimitReached = scannedAll.length > ARREARS_SCAN_LIMIT;
  const scanned = scanLimitReached ? scannedAll.slice(0, ARREARS_SCAN_LIMIT) : scannedAll;

  const today = todayString(options.today);
  const mapped = scanned.map((row) => toArrearsRow(row, policy, today));
  const filtered = params.stage ? mapped.filter((row) => row.stage === params.stage) : mapped;

  const offset = (params.page - 1) * params.pageSize;
  return {
    records: filtered.slice(offset, offset + params.pageSize),
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
    stagePolicy: policy,
    scanLimit: ARREARS_SCAN_LIMIT,
    scanLimitReached,
    amountUnit: ARREARS_AMOUNT_UNIT,
    amountScale: ARREARS_AMOUNT_SCALE,
  };
}

/* ==================================================================
 * 四、B-2 批量催缴（POST /api/platform/billing/arrears/urge，仅站内）
 * ================================================================== */

export const URGE_CHANNEL = "IN_APP";
export const URGE_CHANNEL_NOTE =
  "仅站内通知（写入 t_notification）；本端点不调用短信/邮件/微信等任何外部通道（短信属阶段三，需外部凭据）";
export const URGE_TITLE = "欠费催缴";
export const URGE_RELATED_TYPE = "PLATFORM_BILLING_ARREARS";

export type UrgeItemStatus =
  | "NOTIFIED"
  | "TENANT_NOT_FOUND"
  | "NO_ARREARS"
  | "NO_ACTIVE_ADMIN_USER";

export interface UrgeResultItem {
  tenantId: string;
  tenantName: string | null;
  status: UrgeItemStatus;
  billCount: number;
  /** 欠费金额合计（元 / 2 位小数；无欠费 ⇒ null） */
  amount: number | null;
  dueDate: string | null;
  notifiedUsers: number;
  note: string | null;
}

export interface UrgeResult {
  requested: number;
  uniqueTenants: number;
  notifiedTenants: number;
  totalNotifications: number;
  channel: typeof URGE_CHANNEL;
  channelNote: string;
  amountUnit: string;
  amountScale: number;
  records: UrgeResultItem[];
}

interface TenantRow {
  id: unknown;
  tenantName: unknown;
}

interface ArrearsSummaryRow {
  billCount: unknown;
  amount: unknown;
  dueDate: unknown;
  firstBillId: unknown;
}

interface UserIdRow {
  id: unknown;
}

/** 去重（保序） */
function uniqueTenantIds(tenantIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of tenantIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * 单租户催缴：只写站内通知（`t_notification`，复用 `services/admin/notification.service.ts`）。
 * 边界（诚实声明，不静默）：
 * - 租户不存在 ⇒ `TENANT_NOT_FOUND`（不写通知、不报错整批失败）；
 * - 无待结算欠费 ⇒ `NO_ARREARS`（不写通知，避免无依据催缴）；
 * - 租户无启用中的管理员账号 ⇒ `NO_ACTIVE_ADMIN_USER`（无收件人，如实回 0，不造假收件人）。
 */
async function urgeOneTenant(tenantId: string): Promise<UrgeResultItem> {
  const tenant = await queryOne<TenantRow>(
    `SELECT t.id, COALESCE(t.tenant_name, t.company_name) AS tenantName
     FROM t_tenant t WHERE t.id = ?`,
    [tenantId]
  );
  if (!tenant) {
    return {
      tenantId,
      tenantName: null,
      status: "TENANT_NOT_FOUND",
      billCount: 0,
      amount: null,
      dueDate: null,
      notifiedUsers: 0,
      note: "租户不存在，未写入任何通知",
    };
  }
  const tenantName = tenant.tenantName == null ? null : String(tenant.tenantName);

  const summary = await queryOne<ArrearsSummaryRow>(
    `SELECT COUNT(*) AS billCount, IFNULL(SUM(pending_amount), 0) AS amount,
            MIN(period_end) AS dueDate, MIN(id) AS firstBillId
     FROM t_platform_settlement
     WHERE tenant_id = ? AND status <> 'CANCELLED' AND pending_amount > 0`,
    [tenantId]
  );
  const billCount = Number(summary?.billCount ?? 0);
  const amount = summary ? toNullableAmount(summary.amount) : null;
  const dueDate = summary?.dueDate == null ? null : formatDateValue(summary.dueDate);

  if (billCount <= 0 || amount === null || amount <= 0) {
    return {
      tenantId,
      tenantName,
      status: "NO_ARREARS",
      billCount,
      amount: null,
      dueDate,
      notifiedUsers: 0,
      note: "该租户无待结算欠费（pending_amount > 0 的账单为 0），未发起催缴",
    };
  }

  const users = await query<UserIdRow>(
    "SELECT id FROM t_sys_user WHERE tenant_id = ? AND status = 1",
    [tenantId]
  );
  const recipients = (Array.isArray(users) ? users : []).filter((row) => row?.id != null);

  if (recipients.length === 0) {
    return {
      tenantId,
      tenantName,
      status: "NO_ACTIVE_ADMIN_USER",
      billCount,
      amount,
      dueDate,
      notifiedUsers: 0,
      note: "该租户无启用中的管理员账号，站内通知无收件人；未改派、不造假收件人",
    };
  }

  const content =
    `贵司（${tenantName ?? tenantId}）平台账单已欠费 ${amount.toFixed(ARREARS_AMOUNT_SCALE)} 元` +
    `（最早到期日 ${dueDate ?? "—"}，共 ${billCount} 笔待结算），请及时缴费以免影响服务。`;

  for (const recipient of recipients) {
    await sendNotification({
      recipientId: Number(recipient.id),
      recipientType: "ADMIN",
      title: URGE_TITLE,
      content,
      type: "ALERT",
      relatedId: summary?.firstBillId == null ? null : Number(summary.firstBillId),
      relatedType: URGE_RELATED_TYPE,
      tenantId,
    });
  }

  return {
    tenantId,
    tenantName,
    status: "NOTIFIED",
    billCount,
    amount,
    dueDate,
    notifiedUsers: recipients.length,
    note: null,
  };
}

/** B-2：批量催缴（站内单通道；逐租户独立结果，互不牵连） */
export async function urgeArrears(tenantIds: string[]): Promise<UrgeResult> {
  const unique = uniqueTenantIds(tenantIds);
  const records: UrgeResultItem[] = [];
  for (const tenantId of unique) {
    records.push(await urgeOneTenant(tenantId));
  }

  return {
    requested: tenantIds.length,
    uniqueTenants: unique.length,
    notifiedTenants: records.filter((item) => item.status === "NOTIFIED").length,
    totalNotifications: records.reduce((sum, item) => sum + item.notifiedUsers, 0),
    channel: URGE_CHANNEL,
    channelNote: URGE_CHANNEL_NOTE,
    amountUnit: ARREARS_AMOUNT_UNIT,
    amountScale: ARREARS_AMOUNT_SCALE,
    records,
  };
}

/* ==================================================================
 * 五、B-3 增值扣费流水（GET /api/platform/billing/addon-charges）
 * ==================================================================
 * 表来源：`docs/migrations/176_平台增值扣费流水.sql` 新建的 `t_platform_addon_charge`
 * （C4-0 清账 §八 草案 A1）。
 * 诚实声明：该表**当前无写入方**（计费引擎未落地，见 C4-0 §十一 A11）⇒ 真库查询必然空态；
 *           本端点只做只读列表，不造流水、不代扣。
 * `method`（扣费方式）/`relBill`（关联账单）：草案 A1 无对应列 ⇒ 恒返回 `null`（不造值），
 *           如需落地请由凌舟裁定加列。
 */

export interface AddonChargeListFilter {
  tenantId?: string;
  item?: string;
}

export interface AddonChargeListParams extends AddonChargeListFilter {
  page: number;
  pageSize: number;
}

export interface AddonChargeRow {
  id: number;
  serialNo: string;
  tenantId: string;
  tenantName: string | null;
  item: string;
  /** 单价快照（元 / 4 位小数；NULL = 单价未配置，不填 0） */
  unitPrice: number | null;
  /** 本期用量（超大用量口径见 t_platform_addon_charge.quantity 注释） */
  usage: number;
  /** 扣费金额（元 / 2 位小数；NULL = 单价未配置未出账，不填 0） */
  amount: number | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  /** 扣费方式：草案 A1 无列载体 ⇒ 恒 null */
  method: null;
  /** 关联账单：草案 A1 无列载体 ⇒ 恒 null */
  relBill: null;
  relBillId: null;
  /** 流水时间（created_at） */
  time: string;
}

interface RawAddonChargeRow {
  id: unknown;
  serialNo: unknown;
  tenantId: unknown;
  tenantName: unknown;
  item: unknown;
  unitPrice: unknown;
  quantity: unknown;
  amount: unknown;
  periodStart: unknown;
  periodEnd: unknown;
  status: unknown;
  createdAt: unknown;
}

function toAddonChargeRow(row: RawAddonChargeRow): AddonChargeRow {
  return {
    id: Number(row.id),
    serialNo: row.serialNo == null ? "" : String(row.serialNo),
    tenantId: row.tenantId == null ? "" : String(row.tenantId),
    tenantName: row.tenantName == null || row.tenantName === "" ? null : String(row.tenantName),
    item: row.item == null ? "" : String(row.item),
    unitPrice: toNullableAmount(row.unitPrice),
    usage: toQuantity(row.quantity),
    amount: toNullableAmount(row.amount),
    periodStart: formatDateValue(row.periodStart),
    periodEnd: formatDateValue(row.periodEnd),
    status: row.status == null ? "" : String(row.status),
    method: null,
    relBill: null,
    relBillId: null,
    time: formatDateTimeValue(row.createdAt),
  };
}

export interface AddonChargeListResult {
  records: AddonChargeRow[];
  total: number;
  page: number;
  pageSize: number;
  amountUnit: string;
  amountScale: number;
  unitPriceScale: number;
  /** 契约说明（字段单位/精度、无载体字段） */
  contractNotes: string[];
}

/** 单价精度（t_platform_addon_charge.unit_price 为 DECIMAL(12,4)） */
export const ADDON_UNIT_PRICE_SCALE = 4;

/** B-3：增值扣费流水分页列表（筛选 tenantId/item）；无数据 ⇒ `records: []` */
export async function listAddonCharges(
  params: AddonChargeListParams
): Promise<AddonChargeListResult> {
  const conditions = ["1=1"];
  const values: unknown[] = [];

  if (params.tenantId) {
    conditions.push("c.tenant_id = ?");
    values.push(params.tenantId);
  }
  if (params.item) {
    conditions.push("c.item = ?");
    values.push(params.item);
  }
  const where = conditions.join(" AND ");
  const offset = (params.page - 1) * params.pageSize;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_addon_charge c WHERE ${where}`,
    values
  );
  const rows = await query<RawAddonChargeRow>(
    `SELECT c.id, c.charge_no AS serialNo, c.tenant_id AS tenantId,
            COALESCE(t.tenant_name, t.company_name) AS tenantName,
            c.item, c.unit_price AS unitPrice, c.quantity,
            c.amount, c.period_start AS periodStart, c.period_end AS periodEnd,
            c.status, c.created_at AS createdAt
     FROM t_platform_addon_charge c
     LEFT JOIN t_tenant t ON t.id = c.tenant_id
     WHERE ${where}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  return {
    records: (Array.isArray(rows) ? rows : []).map(toAddonChargeRow),
    total: Number(totalRow?.total ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    amountUnit: ARREARS_AMOUNT_UNIT,
    amountScale: ARREARS_AMOUNT_SCALE,
    unitPriceScale: ADDON_UNIT_PRICE_SCALE,
    contractNotes: [
      "金额单位与精度：unitPrice 为元/4 位小数（DECIMAL(12,4) 单价快照），amount 为元/2 位小数（DECIMAL(12,2)）",
      "`method`（扣费方式）与 `relBill`（关联账单）在 t_platform_addon_charge 无列载体（草案 A1）⇒ 恒为 null，不造值；如需落地须凌舟裁定加列",
      "`null` 表示库内为 NULL（如单价未配置 ⇒ 未出账），与 0.00 语义不同，前端请置「--」而非 0",
      "该表当前无写入方（计费引擎未落地，C4-0 §十一 A11）⇒ 真库列表在接入前如实为空",
    ],
  };
}
