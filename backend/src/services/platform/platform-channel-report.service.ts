/**
 * R101-C6-3-2b：渠道效果报表（**按归因维度聚合**，读侧只读）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §四（路径逐字：GET /api/platform/channel-reports/effect）
 *       卡内要求「**口径与过滤条件必须写进响应或文档说明**」⇒ 本服务把口径（basis）与
 *       本次实际生效的过滤条件（filters）**随响应一起返回**，前端不再自行解释口径。
 *
 * 聚合口径（唯一真相源，逐条可复算）：
 * - 维度（分组键）＝ `t_tenant_attribution` 的归因对象：
 *     `AGENT`    ⇒ 代理商维度（agent_id → t_agent.agent_name）
 *     `PROMO`    ⇒ 推广码维度（promo_code_id → t_promo_code.promo_code / channel_type / channel_name）
 *     `REFERRAL` ⇒ 老带新维度（无代理商、无推广码）
 *   （一租户一条归因：t_tenant_attribution 有 `UNIQUE KEY uk_tenant_attr (tenant_id)`，
 *    故同一租户只会落进一个分组，各维度数字**不重复计数**。）
 * - `tenantCount`   ＝ 该维度下已归因租户数（COUNT(DISTINCT tenant_id)）
 * - `referralCount` ＝ 该维度下 attribution_type='REFERRAL' 的归因行数（一租户一条 ⇒ 等价租户数）
 * - `rewardPoints`  ＝ 该维度下老带新台账 `t_referral_ledger` 中 status<>'REVOKED' 的 reward_points 合计，
 *   按 `l.invitee_tenant_id = a.tenant_id` 关联（uk_invitee ⇒ 一被邀请租户一条台账，不重复计数）
 *
 * 边界（红线①）：**零金额**——不读 `t_subscription`、不读任何金额列、不计算佣金/分润/结算/提现；
 * 只做"归因维度 × 计数 × 奖励积分"的只读聚合。空态诚实：无归因数据 ⇒ `items: []`（不造数）。
 */
import { query } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { ATTRIBUTION_TYPES, type AttributionType } from "./platform-tenant-attribution.service";
import { REFERRAL_ANNUAL_CAP_POINTS, REFERRAL_REWARD_RATE } from "./platform-referral-ledger.service";

/** 结果行（列名统一用别名，避免依赖驱动大小写） */
type Row = Record<string, unknown>;

export interface ChannelEffectItem {
  /** 归因维度：AGENT-代理商邀请 / PROMO-渠道推广码 / REFERRAL-老带新 */
  dimension: AttributionType;
  agentId: number | null;
  agentName: string | null;
  promoCodeId: number | null;
  promoCode: string | null;
  channelType: string | null;
  channelName: string | null;
  tenantCount: number;
  referralCount: number;
  rewardPoints: number;
}

/** 口径说明（随响应返回，避免"口径只活在文档里"） */
export interface ChannelEffectBasis {
  dimension: string;
  tenantCount: string;
  referralCount: string;
  rewardPoints: string;
  rewardRate: number;
  annualCapPoints: number;
  emptyState: string;
  scope: string;
}

export interface ChannelEffectFilters {
  attributionType: string | null;
  channelType: string | null;
}

export interface ChannelEffectReport {
  items: ChannelEffectItem[];
  basis: ChannelEffectBasis;
  /** 本次实际生效的过滤条件回显（未传 ⇒ null，表示该维度不过滤） */
  filters: ChannelEffectFilters;
  /** 合计（供对账：等于各维度之和，且不受分页影响——本报表不分页） */
  totals: {
    tenantCount: number;
    referralCount: number;
    rewardPoints: number;
  };
}

export interface ChannelEffectReportInput {
  attributionType?: string | null;
  channelType?: string | null;
}

/** 空白串（含 "" 与纯空格）归一为 null —— 过滤语义 NULL=不过滤 */
function normalizeNullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** 归一为 number；MySQL SUM/COUNT 可能回字符串，统一收敛（非法回落 0） */
function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

/** 归一主键：NULL/空 ⇒ null（不能把 NULL 折成 0） */
function toNullableId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableText(value: unknown): string | null {
  return normalizeNullableText(value);
}

/** 单行 → 报表项（纯映射，供单测直接喂 fixture 复算） */
export function toChannelEffectItem(row: Row): ChannelEffectItem {
  return {
    dimension: String(row.dimension ?? "") as AttributionType,
    agentId: toNullableId(row.agentId),
    agentName: toNullableText(row.agentName),
    promoCodeId: toNullableId(row.promoCodeId),
    promoCode: toNullableText(row.promoCode),
    channelType: toNullableText(row.channelType),
    channelName: toNullableText(row.channelName),
    tenantCount: toNumber(row.tenantCount),
    referralCount: toNumber(row.referralCount),
    rewardPoints: toNumber(row.rewardPoints),
  };
}

/** 口径说明常量（与 SQL 一一对应；改动 SQL 必须同步改这里，自检脚本会逐字比对关键口径） */
export const CHANNEL_EFFECT_BASIS: ChannelEffectBasis = {
  dimension:
    "按 t_tenant_attribution 的归因对象分组：AGENT=代理商邀请（agent_id → t_agent.agent_name）/ PROMO=渠道推广码（promo_code_id → t_promo_code）/ REFERRAL=老带新",
  tenantCount: "该维度下已归因租户数（COUNT(DISTINCT a.tenant_id)，一租户一条归因 uk_tenant_attr）",
  referralCount: "该维度下 attribution_type='REFERRAL' 的归因行数（一租户一条 ⇒ 等价老带新租户数）",
  rewardPoints:
    "该维度下老带新台账中 status<>'REVOKED' 的 reward_points 合计（按 l.invitee_tenant_id = a.tenant_id 关联，uk_invitee 一被邀请租户一条）",
  rewardRate: REFERRAL_REWARD_RATE,
  annualCapPoints: REFERRAL_ANNUAL_CAP_POINTS,
  emptyState: "无归因数据 ⇒ items: []（不造数、不展示推算值）",
  scope: "只读聚合：不读订阅金额、不计算佣金/分润/结算/提现（属 T9 档 2/3）",
};

/** 聚合 SQL（`{where}` 为占位，参数顺序：过滤条件 → 无） */
function buildEffectSql(where: string): string {
  return `SELECT a.attribution_type AS dimension,
                 a.agent_id AS agentId,
                 g.agent_name AS agentName,
                 a.promo_code_id AS promoCodeId,
                 p.promo_code AS promoCode,
                 p.channel_type AS channelType,
                 p.channel_name AS channelName,
                 COUNT(DISTINCT a.tenant_id) AS tenantCount,
                 SUM(CASE WHEN a.attribution_type = 'REFERRAL' THEN 1 ELSE 0 END) AS referralCount,
                 COALESCE(SUM(CASE WHEN l.status <> 'REVOKED' THEN l.reward_points ELSE 0 END), 0) AS rewardPoints
            FROM t_tenant_attribution a
            LEFT JOIN t_promo_code p ON p.id = a.promo_code_id
            LEFT JOIN t_agent g ON g.id = a.agent_id
            LEFT JOIN t_referral_ledger l ON l.invitee_tenant_id = a.tenant_id
            ${where}
           GROUP BY a.attribution_type, a.agent_id, g.agent_name, a.promo_code_id,
                    p.promo_code, p.channel_type, p.channel_name
           ORDER BY tenantCount DESC, rewardPoints DESC, a.attribution_type ASC`;
}

/**
 * GET /api/platform/channel-reports/effect —— 渠道效果聚合（平台令牌，只读）
 * 过滤条件（可选，全部回显在响应 filters 中）：attributionType ∈ AGENT/PROMO/REFERRAL；channelType 精确匹配。
 * 空态：无归因数据 ⇒ items: [] 且 totals 全 0。
 */
export async function getChannelEffectReport(
  input: ChannelEffectReportInput = {}
): Promise<ChannelEffectReport> {
  const attributionType = normalizeNullableText(input.attributionType);
  const channelType = normalizeNullableText(input.channelType);

  if (attributionType && !(ATTRIBUTION_TYPES as readonly string[]).includes(attributionType)) {
    throw new AppError(
      `归因类型不合法：${attributionType}（仅支持 ${ATTRIBUTION_TYPES.join(" / ")}）`,
      400
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (attributionType) {
    conditions.push("a.attribution_type = ?");
    params.push(attributionType);
  }
  if (channelType) {
    conditions.push("p.channel_type = ?");
    params.push(channelType);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Row>(buildEffectSql(where), params);
  const items = rows.map(toChannelEffectItem);

  return {
    items,
    basis: CHANNEL_EFFECT_BASIS,
    filters: { attributionType, channelType },
    totals: {
      tenantCount: items.reduce((sum, item) => sum + item.tenantCount, 0),
      referralCount: items.reduce((sum, item) => sum + item.referralCount, 0),
      rewardPoints: items.reduce((sum, item) => sum + item.rewardPoints, 0),
    },
  };
}
