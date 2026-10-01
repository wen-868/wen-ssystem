/**
 * R101-C6-3-2b：老带新台账（t_referral_ledger，迁移 195）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §三（表与口径）/ §四（端点）
 *       规划 4.9「老带新奖励 20% / 积分年度上限 60k」；C6-3-凌舟裁定 §5.2（归因落点＝平台侧开租户）
 *
 * 口径（本单**逐字实现**，不自拟）：
 * - 奖励比例：`REFERRAL_REWARD_RATE = 0.2`（20%），单条积分 = floor(计奖基数 × 20%)；
 * - 年度上限：`REFERRAL_ANNUAL_CAP_POINTS = 60000`，**截断口径**（卡 §三 二选一，本单选"截断"）：
 *   单条实际计入 = min(requested, 60000 − 该邀请人**同年** status<>'REVOKED' 的积分合计)；
 *   剩余额度为 0 ⇒ 本条记 0 分并把原因写入 remark（见 `applyAnnualRewardCap`）；
 * - 一被邀请租户一条：uk_invitee，重复登记 ⇒ 409（并发撞唯一键 ER_DUP_ENTRY 同样 409）；
 * - 年度按 `created_at` 的**自然年**（本表无账期列，登记时间即计入时间，口径单一可复算）。
 *
 * 边界（红线① / §二"不做"）：
 * - **零金额**：本服务只读写"奖励积分"与"计奖基数口径名"，不出现任何金额列/金额入参的库字段；
 * - **不实现现金分润 / 结算 / 提现**（属 T9 档 2/3），不建第二处归因写入点（归因写入口仍是
 *   `platform-tenant-attribution.service.ts`，本文件不写 t_tenant_attribution、不改 t_tenant.source）；
 * - **无对外"写台账"端点**（卡 §四 硬约束）：`writeReferralLedgerEntry` 是台账的**唯一写入口**，
 *   只供事件驱动方（归因/订阅事件）在服务层内部调用，不挂任何路由。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { normalizePagination, calculateOffset } from "../../shared/pagination";

/** 台账状态枚举（迁移 195 列注释原文，逐字） */
export const REFERRAL_LEDGER_STATUSES = ["PENDING", "GRANTED", "REVOKED"] as const;
export type ReferralLedgerStatus = (typeof REFERRAL_LEDGER_STATUSES)[number];

/** 奖励比例：老带新 20%（规划 4.9，已敲定，不得配置化改写） */
export const REFERRAL_REWARD_RATE = 0.2;

/** 积分年度上限：60k（规划 4.9，已敲定） */
export const REFERRAL_ANNUAL_CAP_POINTS = 60000;

/** 计奖基数口径：订阅实收（本单唯一口径；表只存口径名，不存金额） */
export const REFERRAL_REWARD_BASIS_SUBSCRIBE = "subscribe_amount";
export const REFERRAL_REWARD_BASIS_VALUES = [REFERRAL_REWARD_BASIS_SUBSCRIBE] as const;

/** 口径展示名（前端零英文口径字面，避免"金额类字段进前端"的误判） */
export const REFERRAL_REWARD_BASIS_LABELS: Record<string, string> = {
  [REFERRAL_REWARD_BASIS_SUBSCRIBE]: "订阅实收",
};

/** 结果行（列名统一用别名，避免依赖驱动大小写） */
type Row = Record<string, unknown>;

/**
 * 可注入的查询执行器：默认走连接池；事件驱动方在事务内调用时传入 conn 适配器，
 * 让台账行与业务事件同事务提交（与 platform-tenant-attribution.service 同款约定）。
 */
export interface ReferralRunner {
  queryOne(sql: string, params?: unknown[]): Promise<Row | null>;
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

const poolRunner: ReferralRunner = {
  queryOne: (sql, params = []) => queryOne<Row>(sql, params),
  query: (sql, params = []) => query(sql, params),
};

export interface ReferralLedgerView {
  id: number;
  inviterTenantId: string;
  inviterName: string | null;
  inviteeTenantId: string;
  inviteeTenantCode: string | null;
  inviteeName: string | null;
  rewardPoints: number;
  rewardBasis: string;
  /** 计奖基数口径的中文展示名（口径名 → 展示名，映射在服务层，前端不拼口径字面） */
  rewardBasisLabel: string;
  /** 邀请人**该行所属自然年**的累计奖励积分（status<>'REVOKED' 口径，与年度上限同口径） */
  inviterYearPoints: number;
  status: string;
  grantedAt: string | Date | null;
  remark: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ReferralLedgerListInput {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export interface ReferralLedgerListResult {
  items: ReferralLedgerView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 台账写入口的入参（**无任何金额字段**）：
 * · basisUnits 是"与 rewardBasis 口径一致的计奖基数"，不是本表列，只用于当场算出 reward_points；
 * · 台账行只落 reward_points（积分）与 reward_basis（口径名）。
 */
export interface ReferralLedgerEntryInput {
  inviterTenantId: string;
  inviteeTenantId: string;
  inviteeTenantCode?: string | null;
  basisUnits: number;
  rewardBasis?: string | null;
  remark?: string | null;
  /** 计入时间（决定年度归属）；不传则用当前时间。传了则同日历口径写入 created_at。 */
  occurredAt?: Date | string | null;
}

export interface ReferralLedgerEntryResult {
  id: number;
  inviterTenantId: string;
  inviteeTenantId: string;
  /** 按 20% 算出的原始积分（未截断） */
  requestedPoints: number;
  /** 该邀请人计入年度内已累计积分（status<>'REVOKED'） */
  usedPointsInYear: number;
  /** 计入年度的剩余额度（60000 − usedPointsInYear，下界 0） */
  remainingPoints: number;
  /** 实际落库积分（受年度上限截断） */
  rewardPoints: number;
  /** 是否被年度上限截断（含"记 0 分"） */
  capped: boolean;
  /** 截断原因（未截断 ⇒ null）；落库时写入 remark */
  capReason: string | null;
  rewardBasis: string;
  /** 计入年度的窗口 [from, to) */
  yearRange: { from: string; to: string };
}

/** 年度上限判定结果（纯函数返回，便于单测与自检复算） */
export interface AnnualCapResult {
  requestedPoints: number;
  usedPoints: number;
  remainingPoints: number;
  grantedPoints: number;
  capped: boolean;
  capReason: string | null;
}

/** 空白串（含 "" 与纯空格）归一为 null —— 列语义 NULL=未填写，不用空串冒充 */
function normalizeNullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** 非负整数归一（SUM 可能回字符串，统一成 number；越界/非法回落 0，绝不让 NaN 进 SQL） */
function normalizeNonNegativeInt(value: unknown): number {
  const num = Math.floor(Number(value ?? 0));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/** 时间列统一格式化为 'YYYY-MM-DD HH:mm:ss'（本地时区，与 DATETIME 语义一致） */
export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`时间格式不正确：${String(value)}`, 400);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** 计入年度的自然年窗口 [YYYY-01-01 00:00:00, (YYYY+1)-01-01 00:00:00) */
export function referralYearRange(year: number): { from: string; to: string } {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new AppError(`计入年度不合法：${String(year)}`, 400);
  }
  return { from: `${year}-01-01 00:00:00`, to: `${year + 1}-01-01 00:00:00` };
}

/** 取时间的自然年（决定本条计入哪一年度） */
export function referralYearOf(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`时间格式不正确：${String(value)}`, 400);
  }
  return date.getFullYear();
}

/**
 * 纯函数：按 20% 口径算单条奖励积分（向下取整，积分是整数）
 * · 计奖基数非法（NaN / 负数 / 非有限）⇒ 400，不落 0 蒙混
 */
export function computeReferralRewardPoints(basisUnits: number): number {
  const basis = Number(basisUnits);
  if (!Number.isFinite(basis) || basis < 0) {
    throw new AppError(`计奖基数不合法：${String(basisUnits)}`, 400);
  }
  return Math.floor(basis * REFERRAL_REWARD_RATE);
}

/**
 * 纯函数：年度上限 60000 的**截断**口径
 * · 剩余额度 = max(0, cap − 已计入)；实际计入 = min(requested, 剩余额度)
 * · 被截断（含剩余为 0 ⇒ 记 0 分）时给出中文原因，原因写入 remark
 */
export function applyAnnualRewardCap(
  requestedPoints: number,
  usedPointsInYear: number,
  cap: number = REFERRAL_ANNUAL_CAP_POINTS
): AnnualCapResult {
  const requested = normalizeNonNegativeInt(requestedPoints);
  const used = normalizeNonNegativeInt(usedPointsInYear);
  const remaining = Math.max(0, cap - used);
  const granted = Math.min(requested, remaining);
  const capped = granted < requested;
  const capReason = capped
    ? remaining > 0
      ? `本年度老带新奖励积分已达上限 ${cap}（已计入 ${used}），本条按剩余额度 ${remaining} 截断计入`
      : `本年度老带新奖励积分已达上限 ${cap}（已计入 ${used}），本条不再累计，记 0 分`
    : null;
  return {
    requestedPoints: requested,
    usedPoints: used,
    remainingPoints: remaining,
    grantedPoints: granted,
    capped,
    capReason,
  };
}

/** 口径展示名（未知口径原样返回，不编造中文） */
export function rewardBasisLabel(rewardBasis: string): string {
  return REFERRAL_REWARD_BASIS_LABELS[rewardBasis] ?? rewardBasis;
}

/** 台账列表的 FROM 段（列表与计数共用，避免两处口径漂移） */
const LEDGER_FROM = `FROM t_referral_ledger l
       LEFT JOIN t_tenant ti ON ti.id = l.inviter_tenant_id
       LEFT JOIN t_tenant tn ON tn.id = l.invitee_tenant_id`;

/** 邀请人**同年**累计（status<>'REVOKED'），按 (inviter, 年) 预聚合后左联，过滤条件不会污染累计值 */
const INVITER_YEAR_TOTALS = `LEFT JOIN (
         SELECT inviter_tenant_id, YEAR(created_at) AS referralYear,
                SUM(reward_points) AS inviterYearPoints
           FROM t_referral_ledger
          WHERE status <> 'REVOKED'
          GROUP BY inviter_tenant_id, YEAR(created_at)
       ) y ON y.inviter_tenant_id = l.inviter_tenant_id
          AND y.referralYear = YEAR(l.created_at)`;

const LEDGER_SELECT = `l.id,
            l.inviter_tenant_id AS inviterTenantId,
            COALESCE(ti.tenant_name, ti.company_name) AS inviterName,
            l.invitee_tenant_id AS inviteeTenantId,
            l.invitee_tenant_code AS inviteeTenantCode,
            COALESCE(tn.tenant_name, tn.company_name) AS inviteeName,
            l.reward_points AS rewardPoints,
            l.reward_basis AS rewardBasis,
            COALESCE(y.inviterYearPoints, 0) AS inviterYearPoints,
            l.status,
            l.granted_at AS grantedAt,
            l.remark,
            l.created_at AS createdAt,
            l.updated_at AS updatedAt`;

function toView(row: Row): ReferralLedgerView {
  const rewardBasis = String(row.rewardBasis ?? "");
  return {
    id: Number(row.id),
    inviterTenantId: String(row.inviterTenantId ?? ""),
    inviterName: normalizeNullableText(row.inviterName),
    inviteeTenantId: String(row.inviteeTenantId ?? ""),
    inviteeTenantCode: normalizeNullableText(row.inviteeTenantCode),
    inviteeName: normalizeNullableText(row.inviteeName),
    rewardPoints: Number(row.rewardPoints ?? 0),
    rewardBasis,
    rewardBasisLabel: rewardBasisLabel(rewardBasis),
    inviterYearPoints: Number(row.inviterYearPoints ?? 0),
    status: String(row.status ?? ""),
    grantedAt: (row.grantedAt as string | Date | null) ?? null,
    remark: normalizeNullableText(row.remark),
    createdAt: row.createdAt as string | Date | undefined,
    updatedAt: row.updatedAt as string | Date | undefined,
  };
}

/**
 * GET /api/platform/referral-ledger —— 分页 + 关键词 + 状态（返回 items/total/page/pageSize）
 * 关键词命中 邀请人/被邀请人 租户ID、被邀请人租户编码、两侧租户名称；空表 ⇒ items: []。
 * 只读：不含任何写语句。
 */
export async function listReferralLedger(
  input: ReferralLedgerListInput = {}
): Promise<ReferralLedgerListResult> {
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const keyword = input.keyword === undefined ? "" : String(input.keyword).trim();
  const status = normalizeNullableText(input.status);

  const conditions: string[] = [];
  const whereParams: unknown[] = [];

  if (keyword) {
    conditions.push(
      `(l.inviter_tenant_id LIKE ? OR l.invitee_tenant_id LIKE ? OR l.invitee_tenant_code LIKE ?` +
        ` OR ti.tenant_name LIKE ? OR ti.company_name LIKE ?` +
        ` OR tn.tenant_name LIKE ? OR tn.company_name LIKE ?)`
    );
    for (let i = 0; i < 7; i += 1) whereParams.push(`%${keyword}%`);
  }
  if (status) {
    conditions.push("l.status = ?");
    whereParams.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRows = await query<{ total: number | string }>(
    `SELECT COUNT(*) AS total ${LEDGER_FROM} ${where}`,
    whereParams
  );
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await query<Row>(
    `SELECT ${LEDGER_SELECT}
       ${LEDGER_FROM}
       ${INVITER_YEAR_TOTALS}
       ${where}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, calculateOffset(page, pageSize)]
  );

  return { items: rows.map(toView), total, page, pageSize };
}

/**
 * **台账唯一写入口**（内部函数，不挂任何对外端点）
 *
 * 事件驱动方（归因 / 订阅事件）在服务层内部调用；失败语义：
 * · 缺邀请人/被邀请人租户ID、邀请人=被邀请人 ⇒ 400（自邀自奖是最低限度防刷，整套防套利属分润域，不在本单）；
 * · 该被邀请租户已有台账行 ⇒ 409（uk_invitee，一被邀请租户只记一次）；并发撞唯一键同样 409；
 * · 计奖基数非法 ⇒ 400；年度额度用尽 ⇒ 落库 reward_points=0 + remark 写明原因（**不是**失败）。
 */
export async function writeReferralLedgerEntry(
  input: ReferralLedgerEntryInput,
  runner: ReferralRunner = poolRunner
): Promise<ReferralLedgerEntryResult> {
  const inviterTenantId = normalizeNullableText(input.inviterTenantId);
  const inviteeTenantId = normalizeNullableText(input.inviteeTenantId);
  if (!inviterTenantId) {
    throw new AppError("缺少邀请人租户ID，无法登记老带新台账", 400);
  }
  if (!inviteeTenantId) {
    throw new AppError("缺少被邀请人租户ID，无法登记老带新台账", 400);
  }
  if (inviterTenantId === inviteeTenantId) {
    throw new AppError("邀请人与被邀请人不能是同一租户", 400);
  }

  const rewardBasis = normalizeNullableText(input.rewardBasis) ?? REFERRAL_REWARD_BASIS_SUBSCRIBE;
  if (!(REFERRAL_REWARD_BASIS_VALUES as readonly string[]).includes(rewardBasis)) {
    throw new AppError(`计奖基数口径不支持：${rewardBasis}`, 400);
  }

  const requestedPoints = computeReferralRewardPoints(input.basisUnits);
  const occurredAt = input.occurredAt ? formatDateTime(input.occurredAt) : null;
  const year = input.occurredAt ? referralYearOf(input.occurredAt) : new Date().getFullYear();
  const yearRange = referralYearRange(year);

  // 一被邀请租户一条：先查一次给明确文案
  const existing = await runner.queryOne(
    "SELECT id FROM t_referral_ledger WHERE invitee_tenant_id = ?",
    [inviteeTenantId]
  );
  if (existing) {
    throw new AppError(
      `该被邀请租户已在老带新台账中（一被邀请租户只记一次），不可重复登记：${inviteeTenantId}`,
      409
    );
  }

  // 年度已计入积分（status<>'REVOKED'，按 created_at 自然年窗口）
  const yearTotalRow = await runner.queryOne(
    `SELECT COALESCE(SUM(reward_points), 0) AS yearPoints
       FROM t_referral_ledger
      WHERE inviter_tenant_id = ?
        AND status <> 'REVOKED'
        AND created_at >= ?
        AND created_at < ?`,
    [inviterTenantId, yearRange.from, yearRange.to]
  );
  const usedPointsInYear = normalizeNonNegativeInt(yearTotalRow?.yearPoints);

  const capped = applyAnnualRewardCap(requestedPoints, usedPointsInYear);
  const remark = [normalizeNullableText(input.remark), capped.capReason]
    .filter((text): text is string => !!text)
    .join(" · ")
    .slice(0, 255);

  let insertId: number;
  try {
    const result: any = await runner.query(
      `INSERT INTO t_referral_ledger
         (inviter_tenant_id, invitee_tenant_id, invitee_tenant_code, reward_points,
          reward_basis, status, remark${occurredAt ? ", created_at" : ""})
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?${occurredAt ? ", ?" : ""})`,
      [
        inviterTenantId,
        inviteeTenantId,
        normalizeNullableText(input.inviteeTenantCode),
        capped.grantedPoints,
        rewardBasis,
        remark === "" ? null : remark,
        ...(occurredAt ? [occurredAt] : []),
      ]
    );
    const single = Array.isArray(result) ? result[0] : result;
    insertId = Number(single?.insertId ?? 0);
  } catch (err) {
    // 并发窗口：唯一键撞车同样按 409 报，不落 500
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      throw new AppError(
        `该被邀请租户已在老带新台账中（一被邀请租户只记一次），不可重复登记：${inviteeTenantId}`,
        409
      );
    }
    throw err;
  }

  if (!insertId) {
    throw new AppError("台账登记失败：未取得新增主键", 500);
  }

  return {
    id: insertId,
    inviterTenantId,
    inviteeTenantId,
    requestedPoints: capped.requestedPoints,
    usedPointsInYear: capped.usedPoints,
    remainingPoints: capped.remainingPoints,
    rewardPoints: capped.grantedPoints,
    capped: capped.capped,
    capReason: capped.capReason,
    rewardBasis,
    yearRange,
  };
}
