/**
 * S3-144：租户归因**唯一写入口**（t_tenant_attribution，迁移 189）
 *
 * 依据：`docs/evidence/S3-144/派单-S3-144-活动任务卡.md` §二 B/C/D 与 §四（归因口径底线）
 *
 * 本文件是该域**唯一**写 `t_tenant_attribution` 与改写 `t_tenant.source` 的地方（公共逻辑只写一次）。
 * 落点（C 定案）：只有 `tenant-register.service.approveTenantApplication`（注册申请审批通过、真正创建
 * 租户那一步）调用本服务写入，租户 id 用该步 `randomUUID()` 生成的真实 id。订阅审核通过
 * （`platform-miniapp.service.auditSubscriptionApply`）既不创建/关联租户、也不携带邀请码
 * ⇒ **不作为归因落点**（无对应租户时不写归因，严禁挂 'default'）。
 *
 * 口径：
 * - 优先级：代理商邀请（AGENT）优先于渠道推广码（PROMO）——同带两者只记 AGENT，promo_code_id 置 NULL。
 * - 一租户一条（uk_tenant_attr）：已存在 ⇒ **409 + 明确中文文案**；并发撞唯一键（ER_DUP_ENTRY）同样按 409 报。
 * - `t_tenant.source` 只写既有三取值（MANUAL / SELF_REGISTER / INVITATION），取值定义一字不改。
 * - 未带 promoCode 且未带 agentId ⇒ `resolveAttributionTarget()` 返回 null，调用方**不写任何行**。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/** 归因类型（迁移 189 列注释原文；本单只写 AGENT / PROMO） */
export const ATTRIBUTION_TYPES = ["AGENT", "PROMO", "REFERRAL"] as const;
export type AttributionType = (typeof ATTRIBUTION_TYPES)[number];

/** `t_tenant.source` 既有三取值（016/029 迁移的列注释原文，不得改写） */
export const TENANT_SOURCES = ["MANUAL", "SELF_REGISTER", "INVITATION"] as const;
export type TenantSource = (typeof TENANT_SOURCES)[number];

/** 结果行（列名统一用别名，避免依赖驱动大小写） */
type Row = Record<string, unknown>;

/**
 * 可注入的查询执行器。
 *
 * 默认走连接池（`poolRunner`）；在事务内写入时传入 `conn` 适配器，
 * 让归因行与建租户同事务提交，避免"租户建好、归因丢失"的半成品状态。
 */
export interface AttributionRunner {
  queryOne(sql: string, params?: unknown[]): Promise<Row | null>;
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

const poolRunner: AttributionRunner = {
  queryOne: (sql, params = []) => queryOne<Row>(sql, params),
  query: (sql, params = []) => query(sql, params),
};

export interface AttributionTargetInput {
  /** 推广码码值（不是主键 id） */
  promoCode?: string | null;
  /** 代理商主键（t_agent.id） */
  agentId?: number | string | null;
}

/** 解析后的归因目标：promoCodeId 与 agentId 至少一个非空 */
export interface ResolvedAttributionTarget {
  attributionType: AttributionType;
  promoCodeId: number | null;
  agentId: number | null;
}

export interface WriteTenantAttributionInput extends ResolvedAttributionTarget {
  tenantId: string;
  attributedAt?: Date | string | null;
}

export interface WriteTenantAttributionResult {
  id: number;
  tenantId: string;
  attributionType: AttributionType;
  promoCodeId: number | null;
  agentId: number | null;
  attributedAt: string;
  /** 写入后的来源列取值（既有三取值之一；null = 不改写） */
  source: string | null;
  /** 是否真的改写了 t_tenant.source（已等于目标值时 false） */
  sourceUpdated: boolean;
}

/** 空白串（含 "" 与纯空格）归一为 null —— 列语义 NULL=未填写，不用空串冒充 */
function normalizeNullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** 归一为正整数主键；非法（0/负数/小数/非数字）返回 null */
function normalizePositiveId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
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

/** 从 query() 的返回里取新增主键（真实库是 ResultSetHeader，mock 库可能是数组） */
function extractInsertId(result: unknown): number {
  const single = Array.isArray(result) ? result[0] : result;
  const id = (single as { insertId?: unknown } | undefined)?.insertId;
  return Number(id ?? 0);
}

/**
 * 解析归因目标（**校验 + 归一，不写库**）
 *
 * 在**创建租户之前**调用：目标非法（代理商不存在/推广码不存在或已停用）时直接 400，
 * 不留下"没有归因的半成品租户"。
 *
 * · 未带 promoCode 且未带 agentId ⇒ 返回 null（不得造默认归因）
 * · agentId 优先：同带两者时只解析代理商，不查码
 * · 推广码必须存在且 status='ACTIVE'（已停用的码不可再用于归因）
 */
export async function resolveAttributionTarget(
  input: AttributionTargetInput = {},
  runner: AttributionRunner = poolRunner
): Promise<ResolvedAttributionTarget | null> {
  const rawAgentId = input.agentId;
  const hasRawAgentId =
    rawAgentId !== undefined && rawAgentId !== null && String(rawAgentId).trim() !== "";
  const agentId = hasRawAgentId ? normalizePositiveId(rawAgentId) : null;
  const promoCode = normalizeNullableText(input.promoCode);

  if (hasRawAgentId && agentId === null) {
    throw new AppError(`代理商ID不合法：${String(rawAgentId)}`, 400);
  }

  // 未带码、未带代理商 ⇒ 不写归因行（不得造默认归因）
  if (agentId === null && promoCode === null) return null;

  // 代理商邀请优先于渠道推广码
  if (agentId !== null) {
    const agent = await runner.queryOne("SELECT id FROM t_agent WHERE id = ?", [agentId]);
    if (!agent) {
      throw new AppError(`代理商不存在：${agentId}`, 400);
    }
    return { attributionType: "AGENT", promoCodeId: null, agentId };
  }

  const promo = await runner.queryOne(
    "SELECT id, status FROM t_promo_code WHERE promo_code = ?",
    [promoCode]
  );
  if (!promo) {
    throw new AppError(`推广码不存在：${promoCode}`, 400);
  }
  if (String(promo.status) !== "ACTIVE") {
    throw new AppError(`推广码已停用，不可用于归因：${promoCode}`, 400);
  }
  return { attributionType: "PROMO", promoCodeId: Number(promo.id), agentId: null };
}

/**
 * 由"当前来源 + 归因类型"推导写入后的来源列取值（**只使用既有三取值**）
 *
 * · 当前已是 SELF_REGISTER ⇒ 原样保持（业主口径"自注册保持 SELF_REGISTER 不受影响"）
 * · AGENT / PROMO ⇒ INVITATION（代理商邀请 / 渠道推广码都属"被邀请而来"）
 * · 其它（含 REFERRAL，本单不写）⇒ null，表示不改写来源列
 */
export function resolveTenantSource(
  currentSource: string | null | undefined,
  attributionType: AttributionType
): TenantSource | null {
  const current = normalizeNullableText(currentSource);
  if (current === "SELF_REGISTER") return "SELF_REGISTER";
  if (attributionType === "AGENT" || attributionType === "PROMO") return "INVITATION";
  return null;
}

/**
 * 写入一条租户归因（**唯一写入口**）
 *
 * 前置：调用方必须先 `resolveAttributionTarget()` 拿到 promoCodeId / agentId。
 * 失败语义：租户不存在 ⇒ 404；该租户已有归因行 ⇒ 409；缺租户ID / 两者皆空 ⇒ 400。
 */
export async function writeTenantAttribution(
  input: WriteTenantAttributionInput,
  runner: AttributionRunner = poolRunner
): Promise<WriteTenantAttributionResult> {
  const tenantId = normalizeNullableText(input.tenantId);
  if (!tenantId) {
    throw new AppError("缺少租户ID，无法写入归因", 400);
  }
  if (!input.promoCodeId && !input.agentId) {
    throw new AppError("归因写入至少需要推广码或代理商之一", 400);
  }

  // 一租户一条：先查一次给明确文案
  const existing = await runner.queryOne(
    "SELECT id FROM t_tenant_attribution WHERE tenant_id = ?",
    [tenantId]
  );
  if (existing) {
    throw new AppError(
      `该租户已存在归因记录（一租户一条归因），不可重复归因：${tenantId}`,
      409
    );
  }

  // 归因对象必须真实存在；取当前 source 以便按既有语义决定是否改写
  const tenant = await runner.queryOne("SELECT source FROM t_tenant WHERE id = ?", [tenantId]);
  if (!tenant) {
    throw new AppError(`租户不存在，无法写入归因：${tenantId}`, 404);
  }

  const attributedAt = input.attributedAt
    ? formatDateTime(input.attributedAt)
    : formatDateTime(new Date());

  let insertId: number;
  try {
    const result = await runner.query(
      `INSERT INTO t_tenant_attribution
         (tenant_id, promo_code_id, agent_id, attributed_at, attribution_type)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, input.promoCodeId, input.agentId, attributedAt, input.attributionType]
    );
    insertId = extractInsertId(result);
  } catch (err) {
    // 并发窗口：唯一键撞车同样按 409 报，不落 500
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      throw new AppError(
        `该租户已存在归因记录（一租户一条归因），不可重复归因：${tenantId}`,
        409
      );
    }
    throw err;
  }

  if (!insertId) {
    throw new AppError("归因写入失败：未取得新增主键", 500);
  }

  // 来源列：只写既有三取值，且必须真正变化才 UPDATE（避免无意义写与审计噪声）
  const currentSource = normalizeNullableText(tenant.source);
  const nextSource = resolveTenantSource(currentSource, input.attributionType);
  let sourceUpdated = false;
  if (nextSource && nextSource !== currentSource) {
    await runner.query("UPDATE t_tenant SET source = ? WHERE id = ?", [nextSource, tenantId]);
    sourceUpdated = true;
  }

  return {
    id: insertId,
    tenantId,
    attributionType: input.attributionType,
    promoCodeId: input.promoCodeId ?? null,
    agentId: input.agentId ?? null,
    attributedAt,
    source: nextSource ?? currentSource,
    sourceUpdated,
  };
}
