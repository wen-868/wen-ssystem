/**
 * 订单进度契约常量与纯函数（TOTAL-ORDER-PROGRESS-02）
 *
 * 唯一真相源：projects/ms/design/ORDER-PROGRESS-CONTRACT-v1.md（F2 收口版）
 * - §2.3 order_family 14 族 token
 * - §三 各族 business_stage 值域
 * - §2.2 事件名规则 order.progress.<family>.<stage 小写>
 * - §4.1 source_event_id 六成分（零时间戳、不依赖 progress_seq）
 * - §5.4 AI 小写六态禁入业务字段（写侧硬拦，与反测装置同口径）
 * - §7.1 failure_code 九码 + 适用族 + retry/manual 映射要求
 * - §4.4 终态集合（ended_at 必填）
 *
 * 负责人：阿坚（总台后端与数据）｜创建日期：2026-10-28
 */
import { createHash } from "node:crypto";

/** §2.3 全部 14 个真实订单族 */
export const ORDER_FAMILIES = [
  "sale_bill", "miniapp_retail", "miniapp_wholesale", "instant_platform", "instant_retail",
  "purchase", "transfer", "aftersale", "sale_return", "refund", "payment",
  "timeout_exception", "points_mall", "seckill",
] as const;
export type OrderFamily = (typeof ORDER_FAMILIES)[number];

/** §三 各族阶段值域（本卡只启用 sale_bill 全量；其余族先建壳，事件写入由各族实现卡接入） */
export const FAMILY_STAGES: Record<OrderFamily, readonly string[]> = {
  // 与 t_sale_bill.business_status DDL 值域一致（docs/init_database.sql:717：DRAFT/CREATED/COMPLETED/VOIDED/RETURNED）
  sale_bill: ["DRAFT", "CREATED", "COMPLETED", "VOIDED", "RETURNED"],
  miniapp_retail: ["PENDING_PAYMENT", "PENDING_SHIP", "ACCEPTED", "DELIVERING", "COMPLETED", "CANCELLED"],
  miniapp_wholesale: ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"],
  instant_platform: ["PENDING", "ACCEPTED", "DELIVERING", "COMPLETED", "CANCELLED"],
  instant_retail: ["PENDING", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"],
  purchase: ["DRAFT", "PENDING", "APPROVED", "PARTIAL", "COMPLETED", "CANCELLED"],
  transfer: ["DRAFT", "PENDING", "APPROVED", "TRANSIT", "RECEIVED", "CANCELLED", "REJECTED"],
  aftersale: ["PENDING", "APPROVED", "PROCESSING", "RETURNING", "RECEIVED", "COMPLETED", "REJECTED", "CANCELLED"],
  sale_return: ["PENDING", "COMPLETED", "REJECTED", "VOIDED"],
  refund: ["PENDING", "PROCESSING", "SUCCESS", "FAILED"],
  payment: ["PENDING", "SUCCESS", "FAILED", "CLOSED", "REFUNDED"],
  timeout_exception: ["DETECTED", "PROCESSING", "RESOLVED", "IGNORED"],
  points_mall: ["PENDING", "DELIVERED", "CANCELLED"],
  seckill: ["PENDING_PAY", "PAID", "CANCELLED", "EXPIRED"],
};

/** §4.4 终态集合（按族判定；stage 级终态值域） */
export const TERMINAL_STAGES: ReadonlySet<string> = new Set([
  "COMPLETED", "VOIDED", "RETURNED", "CANCELLED", "RECEIVED", "REJECTED",
  "REFUNDED", "FAILED", "RESOLVED", "IGNORED", "CLOSED", "EXPIRED", "DELIVERED",
]);

/** §5.4 AI PlanStepStatus 小写六态——禁入 business_stage / business_status（写侧硬拦，与契约反测 §9.2 同判据） */
export const AI_STEP_STATES: ReadonlySet<string> = new Set([
  "pending", "running", "success", "failed", "suspended", "skipped",
]);

/** §7.1 failure_code 九码白名单（含适用族与 retry/manual 映射要求） */
export const FAILURE_CODES: Record<string, { families: readonly string[]; needRetryEntry: boolean; needManualUrl: boolean }> = {
  PAYMENT_TIMEOUT: { families: ["miniapp_retail", "miniapp_wholesale", "seckill"], needRetryEntry: true, needManualUrl: false },
  STOCK_INSUFFICIENT: { families: ["purchase", "miniapp_wholesale", "seckill"], needRetryEntry: true, needManualUrl: false },
  APPROVAL_REJECTED: { families: ["purchase", "transfer", "sale_return", "aftersale"], needRetryEntry: true, needManualUrl: false },
  DELIVERY_FAILED: { families: ["miniapp_retail", "instant_platform", "instant_retail"], needRetryEntry: true, needManualUrl: false },
  REFUND_FAILED: { families: ["refund", "sale_return"], needRetryEntry: true, needManualUrl: false },
  SYNC_FAILED: { families: ["miniapp_retail"], needRetryEntry: true, needManualUrl: false },
  EXCEPTION_UNRESOLVED: { families: ["timeout_exception"], needRetryEntry: true, needManualUrl: true },
  TRANSFER_REJECTED: { families: ["transfer"], needRetryEntry: true, needManualUrl: false },
  AFTERSALE_REJECTED: { families: ["aftersale"], needRetryEntry: true, needManualUrl: false },
};

/** 需要人工兜底入口的失败码（§7.2） */
export const MANUAL_INTERVENTION_CODES: ReadonlySet<string> = new Set(
  Object.entries(FAILURE_CODES).filter(([, v]) => v.needManualUrl).map(([k]) => k),
);

/**
 * 六成分稳定幂等键（§4.1 F2 定稿）：
 * source_event_id = SHA-256("tenant_id|order_family|order_no|business_stage|actor_key|upstream_biz_key")
 * 硬性规则：不含时间戳、不含 progress_seq、不含客户端随机值（upstream 必须是稳定业务键或跨重试复用的请求键）。
 */
export function makeSourceEventId(parts: {
  tenantId: string;
  orderFamily: string;
  orderNo: string;
  businessStage: string;
  actorKey: string;
  upstreamBizKey: string;
}): string {
  const raw = [parts.tenantId, parts.orderFamily, parts.orderNo, parts.businessStage, parts.actorKey, parts.upstreamBizKey].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** idempotency_key = sha256(source_event_id)（§4.1） */
export function makeIdempotencyKey(sourceEventId: string): string {
  return createHash("sha256").update(sourceEventId, "utf8").digest("hex");
}

/** §2.2 事件名机械派生：order.progress.<family>.<stage 小写> */
export function makeEventName(orderFamily: string, businessStage: string): string {
  return `order.progress.${orderFamily}.${businessStage.toLowerCase()}`;
}

/**
 * actor_key（§4.1 表）：user/admin/ai 用 actor_id；system/cron 用 "{actor_type}:{主体名}"。
 *
 * 主体名来源优先级：显式 actorId（推荐）→ actorFallback。
 * 裸 actor_type 仍禁止（两个不同主体不得碰撞，§4.1 规则 4）；
 * actorFallback 是**调用点绑定的稳定主体名**（同一函数恒同值 ⇒ 重试幂等成立）。
 */
export function makeActorKey(
  actorType: string,
  actorId: string | number | null | undefined,
  actorFallback?: string,
): string {
  if (actorType === "system" || actorType === "cron") {
    const subject = (actorId != null && String(actorId).trim() !== "")
      ? String(actorId)
      : (actorFallback ?? "");
    if (subject === "") {
      throw new OrderProgressContractError(`actor_type=${actorType} 必须携带稳定主体键（显式 actor_id 或调用点 actorFallback），禁止用 actor_type 裸值充当（§4.1 规则4）`);
    }
    return `${actorType}:${subject}`;
  }
  if (actorId == null || String(actorId).trim() === "") {
    if (actorFallback) return `${actorType}:${actorFallback}`;
    throw new OrderProgressContractError(`actor_type=${actorType} 必须携带实际操作者 actor_id（§2.1）`);
  }
  return String(actorId);
}

/** 契约违约错误（写侧硬拦：AI 六态、族外 stage、九码外 failure、缺映射列等） */
export class OrderProgressContractError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "OrderProgressContractError";
  }
}

export interface OrderProgressEventInput {
  tenantId: string;
  storeId?: number | null;
  orderFamily: OrderFamily;
  orderNo: string;
  businessStage: string;
  businessStatus: string;
  actorType: "system" | "user" | "admin" | "ai" | "cron";
  actorId?: number | string | null;
  /** 稳定上游业务键：业务单号/回调号/跨重试复用的请求键；禁止时间戳或一次性随机值 */
  upstreamBizKey: string;
  failureCode?: string | null;
  retryEntry?: string | null;
  manualInterventionUrl?: string | null;
  statusReason?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  visibleTo: readonly string[];
  fieldFilter: Record<string, unknown>;
  /** 调用点绑定的稳定主体名（system/cron 缺显式 actor_id 时兜底；同函数恒同值 ⇒ 重试幂等） */
  actorFallback?: string;
}

/**
 * 写侧契约校验（§一 原则 + §2.1 + §4.1 + §7.1 闭环 + §9.2 判据）。
 * 返回派生好的键与事件名，供写入器落库。
 */
export function validateAndDerive(input: OrderProgressEventInput): {
  sourceEventId: string;
  idempotencyKey: string;
  eventName: string;
  actorKey: string;
} {
  if (!input.tenantId) throw new OrderProgressContractError("tenant_id 必填（§2.1）");
  if (!ORDER_FAMILIES.includes(input.orderFamily)) {
    throw new OrderProgressContractError(`order_family=${input.orderFamily} 不在 §2.3 的 14 族清单`);
  }
  if (!input.orderNo) throw new OrderProgressContractError("order_no 必填（§2.1）");
  // AI 六态禁入业务字段（business_stage / business_status 任一命中即判红）
  if (AI_STEP_STATES.has(input.businessStage)) {
    throw new OrderProgressContractError(`business_stage=${input.businessStage} 是 AI 步骤态（PlanStepStatus），禁止写入业务阶段（§5.4/§9.2）`);
  }
  if (AI_STEP_STATES.has(input.businessStatus)) {
    throw new OrderProgressContractError(`business_status=${input.businessStatus} 是 AI 步骤态（PlanStepStatus），禁止冒充业务状态（§5.4/§9.2）`);
  }
  const stages = FAMILY_STAGES[input.orderFamily];
  if (!stages.includes(input.businessStage)) {
    throw new OrderProgressContractError(`business_stage=${input.businessStage} 不属于 ${input.orderFamily} 的 §三 阶段值域`);
  }
  if (!input.upstreamBizKey || String(input.upstreamBizKey).trim() === "") {
    throw new OrderProgressContractError("upstream_biz_key 必填且必须是稳定业务键（§4.1）");
  }
  const actorKey = makeActorKey(input.actorType, input.actorId, input.actorFallback);
  // failure_code 闭环（§7.1：Schema 列 ⇄ 白名单 ⇄ 映射 ⇄ 人工入口）
  if (input.failureCode != null && input.failureCode !== "") {
    const def = FAILURE_CODES[input.failureCode];
    if (!def) throw new OrderProgressContractError(`failure_code=${input.failureCode} 不在 §7.1 九码白名单`);
    if (!def.families.includes(input.orderFamily)) {
      throw new OrderProgressContractError(`failure_code=${input.failureCode} 不适用于族 ${input.orderFamily}（§7.1 适用族列）`);
    }
    if (def.needRetryEntry && !input.retryEntry) {
      throw new OrderProgressContractError(`failure_code=${input.failureCode} 必须携带 retry_entry（§7.1 重试入口列闭环）`);
    }
    if (def.needManualUrl && !input.manualInterventionUrl) {
      throw new OrderProgressContractError(`failure_code=${input.failureCode} 必须携带 manual_intervention_url（§7.2）`);
    }
  }
  // FAILED/REJECTED 阶段必带 failure_code（§九 校验器同口径）
  if ((input.businessStage === "FAILED" || input.businessStage === "REJECTED") && !input.failureCode) {
    throw new OrderProgressContractError(`阶段 ${input.businessStage} 必须携带 failure_code（§2.1 终态异常必填）`);
  }
  // 终态必填 ended_at（§4.4/§2.1）
  if (TERMINAL_STAGES.has(input.businessStage) && !input.endedAt) {
    throw new OrderProgressContractError(`终态阶段 ${input.businessStage} 必须携带 ended_at（§4.4）`);
  }
  if (!Array.isArray(input.visibleTo) || input.visibleTo.length === 0) {
    throw new OrderProgressContractError("visible_to 必填非空（§六）");
  }
  if (!input.fieldFilter || typeof input.fieldFilter !== "object" || Object.keys(input.fieldFilter).length === 0) {
    throw new OrderProgressContractError("field_filter 必填对象（§五/§8.2 持久化裁决快照）");
  }
  const sourceEventId = makeSourceEventId({
    tenantId: input.tenantId,
    orderFamily: input.orderFamily,
    orderNo: input.orderNo,
    businessStage: input.businessStage,
    actorKey,
    upstreamBizKey: input.upstreamBizKey,
  });
  return {
    sourceEventId,
    idempotencyKey: makeIdempotencyKey(sourceEventId),
    eventName: makeEventName(input.orderFamily, input.businessStage),
    actorKey,
  };
}
