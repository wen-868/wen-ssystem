/**
 * 订单进度事件底座 · 只读查询（TOTAL-ORDER-PROGRESS-02）
 *
 * 契约：projects/ms/design/ORDER-PROGRESS-CONTRACT-v1.md
 * - §4.3 查询接口：since_seq 增量补拉 + 游标分页（base64(progress_seq)）+ last_seq
 * - §5.1 跨租户强制：WHERE tenant_id = ?（租户来自 JWT，缺失即 403）
 * - §5.2 门店隔离：门店级用户只能查本门店订单
 * - §5.3/§5.4 字段过滤：按调用者可见角色裁剪字段；AI 通道白名单（金额/价格/个人信息/操作人一律不返回）
 * - §六 visible_to：事件可见角色与调用者角色取交集，交集为空不下发
 *
 * 负责人：阿坚（总台后端与数据）｜创建日期：2026-10-28
 */
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { RowDataPacket } from "mysql2";
import { AppError } from "../../shared/app-error";
import { ORDER_FAMILIES, type OrderFamily } from "../../shared/order-progress-contract";

/** 事件原始行（snake_case，直读 t_order_progress_event） */
interface EventRow extends RowDataPacket {
  progress_seq: number;
  tenant_id: string;
  store_id: number | null;
  order_family: string;
  order_no: string;
  source_event_id: string;
  event_name: string;
  event_version: string;
  business_stage: string;
  business_status: string;
  failure_code: string | null;
  retry_entry: string | null;
  manual_intervention_url: string | null;
  status_reason: string | null;
  actor_type: string;
  actor_id: string | null;
  visible_to: string | unknown[] | null;
  field_filter: string | Record<string, unknown> | null;
  idempotency_key: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  created_at: Date | string;
}

/** 主表当前阶段行 */
interface CurrentStageRow extends RowDataPacket {
  progress_seq: number;
  business_stage: string;
  business_status: string;
}

/** 应用角色码 → 事件可见角色 token（§六 词表） */
export const ROLE_TO_VISIBILITY: Record<string, string[]> = {
  SUPER_ADMIN: ["hq_admin"],
  OPERATION_ADMIN: ["hq_admin"],
  STORE_MANAGER: ["store_manager", "hq_admin"],
  SALES_STAFF: ["store_staff"],
  CASHIER: ["store_staff"],
  WAREHOUSE_STAFF: ["warehouse"],
  PURCHASE_STAFF: ["purchaser"],
  FINANCE_STAFF: ["finance"],
  CUSTOMER_SERVICE: ["customer_service"],
  READONLY: ["store_staff"],
  PLATFORM_OPS: ["platform_ops", "ops"],
};

/** AI 通道可读字段白名单（§5.4；物理裁剪，金额/价格/个人信息/操作人一律不返回） */
export const AI_VISIBLE_FIELDS = [
  "order_family", "order_no", "business_stage", "business_status",
  "started_at", "ended_at", "status_reason", "failure_code", "actor_type",
] as const;

/**
 * 自由文本金额脱敏（契约 §5.4：AI 不可读金额；写侧 field_filter.money_in_free_text 声明哪些文本列可能夹带金额）。
 * 命中即把数字段替换为 ***，避免"应收 258.00"这类文本绕过列级过滤泄露金额。
 */
export function scrubMoneyInText(text: string | null, fields: readonly string[], col: string): string | null {
  if (text == null) return null;
  if (!fields.includes(col)) return text;
  return text.replace(/\d[\d.,]*/g, "***");
}

export type ProgressChannel = "human" | "ai";

export interface ProgressCaller {
  tenantId: string;
  roles: string[];
  storeId?: number | null;
  /** 是否门店级用户（店长/店员/收银/仓管/客服 ⇒ 只能看本门店） */
  storeScoped: boolean;
}

/** 从 req.user 解析调用者（租户缺失 ⇒ 403，§5.1） */
export function resolveCaller(user: { tenantId?: string; roles?: string[]; storeId?: number | null } | undefined): ProgressCaller {
  const tenantId = user?.tenantId;
  if (!tenantId) throw new AppError("缺少租户上下文，禁止查询订单进度", 403);
  const roles = Array.isArray(user?.roles) ? user!.roles! : [];
  const storeScoped =
    roles.some((r) => ["STORE_MANAGER", "SALES_STAFF", "CASHIER", "WAREHOUSE_STAFF", "CUSTOMER_SERVICE"].includes(r)) &&
    !roles.includes("SUPER_ADMIN");
  return { tenantId, roles, storeId: user?.storeId ?? null, storeScoped };
}

/** 调用者可见角色 token 集合 */
export function callerVisibilityTokens(caller: ProgressCaller): Set<string> {
  const tokens = new Set<string>();
  for (const r of caller.roles) for (const t of ROLE_TO_VISIBILITY[r] ?? []) tokens.add(t);
  return tokens;
}

/** 游标：base64url(progress_seq)（§4.3） */
export function encodeCursor(seq: number): string {
  return Buffer.from(JSON.stringify({ seq }), "utf8").toString("base64url");
}
export function decodeCursor(cursor?: string | null): number | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { seq?: unknown };
    const n = Number(parsed?.seq);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function parseJsonCol<T>(v: unknown): T[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "object") return v as unknown as T[];
  try { return JSON.parse(String(v)) as T[]; } catch { return null; }
}

export interface ProgressQueryParams {
  orderFamily: string;
  orderNo: string;
  sinceSeq?: number | null;
  cursor?: string | null;
  limit?: number;
  channel?: ProgressChannel;
}

export interface ProgressEventView {
  progress_seq: number;
  event_name: string;
  event_version: string;
  order_family: string;
  order_no: string;
  business_stage: string;
  business_status: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  created_at?: Date | string;
  status_reason?: string | null;
  failure_code?: string | null;
  retry_entry?: string | null;
  manual_intervention_url?: string | null;
  actor_type?: string;
  actor_id?: string | null;
  store_id?: number | null;
  idempotency_key?: string;
  source_event_id?: string;
  visible_to?: string[];
}

export interface ProgressQueryResult {
  order_no: string;
  order_family: string;
  current_stage: string | null;
  current_status: string | null;
  events: ProgressEventView[];
  next_cursor: string | null;
  has_more: boolean;
  last_seq: number;
}

/** field_filter.money_in_free_text 结构 */
interface MoneyTextCfg {
  fields?: string[];
  exempt_roles?: string[];
}
function moneyTextCfg(filter: unknown): MoneyTextCfg {
  const cfg = (Array.isArray(filter) ? filter[0] : filter) as { money_in_free_text?: MoneyTextCfg } | undefined;
  return cfg?.money_in_free_text ?? {};
}

/** AI 通道字段裁剪（§5.4：仅白名单字段，且自由文本金额打码） */
export function projectForAi(row: EventRow): ProgressEventView {
  const mt = moneyTextCfg(parseJsonCol<unknown>(row.field_filter));
  const fields = mt.fields ?? [];
  return {
    order_family: row.order_family,
    order_no: row.order_no,
    business_stage: row.business_stage,
    business_status: row.business_status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    status_reason: scrubMoneyInText(row.status_reason, fields, "status_reason"),
    failure_code: row.failure_code,
    actor_type: row.actor_type,
    progress_seq: row.progress_seq,
    event_name: row.event_name,
    event_version: row.event_version,
  };
}

/**
 * 人读字段过滤：事件落库时已带 field_filter.hidden_fields.<role> 裁决快照（§8.2），
 * 读侧按调用者角色的隐藏字段清单裁剪——历史事件按**当时**的裁决脱敏，不随角色矩阵变更错位。
 */
export function projectForHuman(row: EventRow, caller: ProgressCaller): ProgressEventView {
  const cfgRaw = parseJsonCol<Record<string, unknown>>(row.field_filter);
  const cfg = (Array.isArray(cfgRaw) ? cfgRaw[0] : cfgRaw) as { hidden_fields?: Record<string, string[]> } | undefined;
  const hidden = new Set<string>();
  const tokens = callerVisibilityTokens(caller);
  for (const [token, fields] of Object.entries(cfg?.hidden_fields ?? {})) {
    // store_manager 继承 store_staff 的隐藏面（矩阵只写更宽的一侧时不误放宽）
    if (tokens.has(token) || (token === "store_staff" && tokens.has("store_manager"))) {
      for (const f of fields) hidden.add(f);
    }
  }
  // 自由文本金额脱敏（§5.3/§5.4）：调用者角色不在 money_in_free_text.exempt_roles ⇒ 文本内金额数字打码
  const mt = moneyTextCfg(cfg);
  const needScrub = (mt.fields ?? []).length > 0 && !(mt.exempt_roles ?? []).some((r) => tokens.has(r));
  const scrubText = (v: string | null) => (needScrub ? scrubMoneyInText(v, mt.fields ?? [], "status_reason") : v);
  return {
    progress_seq: row.progress_seq,
    event_name: row.event_name,
    event_version: row.event_version,
    order_family: row.order_family,
    order_no: row.order_no,
    business_stage: row.business_stage,
    business_status: row.business_status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
    status_reason: hidden.has("status_reason") ? null : scrubText(row.status_reason),
    failure_code: row.failure_code,
    retry_entry: hidden.has("retry_entry") ? null : row.retry_entry,
    manual_intervention_url: hidden.has("manual_intervention_url") ? null : row.manual_intervention_url,
    actor_type: row.actor_type,
    actor_id: hidden.has("actor_id") ? null : row.actor_id,
    store_id: hidden.has("store_id") ? null : row.store_id,
    idempotency_key: hidden.has("idempotency_key") ? undefined : row.idempotency_key,
    source_event_id: hidden.has("source_event_id") ? undefined : row.source_event_id,
    visible_to: parseJsonCol<string>(row.visible_to) ?? [],
  };
}

/** 族 token 校验（路由入口用，非法族 ⇒ 400；与 §2.3 清单一致） */
export function assertKnownFamily(family: string): OrderFamily {
  if (!(ORDER_FAMILIES as readonly string[]).includes(family)) throw new AppError(`未知订单族：${family}`, 400);
  return family as OrderFamily;
}

/** 需要按主表门店做隔离的族（门店级用户只能看本门店订单，§5.2） */
const STORE_SCOPED_FAMILIES: Partial<Record<OrderFamily, { table: string; noCol: string }>> = {
  sale_bill: { table: "t_sale_bill", noCol: "bill_no" },
  miniapp_retail: { table: "t_miniapp_order", noCol: "order_no" },
};

/**
 * 订单进度查询（§4.3）。
 *
 * 强制判据：
 * 1. `WHERE tenant_id = ?`（§5.1，跨租户零命中）；
 * 2. 门店级用户 ⇒ 订单主表 store_id 必须命中本门店，否则 404（不泄露存在性，同 S3-209 口径）；
 * 3. visible_to 与调用者角色取交集（AI 通道走 §5.4 白名单投影）。
 */
export async function queryOrderProgress(
  caller: ProgressCaller,
  params: ProgressQueryParams,
): Promise<ProgressQueryResult> {
  const family = assertKnownFamily(params.orderFamily);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const cursorSeq = decodeCursor(params.cursor);
  const sinceSeq = params.sinceSeq != null && Number.isFinite(params.sinceSeq) ? Math.max(0, Math.floor(params.sinceSeq)) : null;
  const fromSeq = Math.max(cursorSeq ?? 0, sinceSeq ?? 0);

  // 门店隔离：先确认该单在本门店可见（sale_bill / miniapp_retail 各自主表）
  const scope = STORE_SCOPED_FAMILIES[family];
  if (caller.storeScoped && scope) {
    const bill = await queryOneWithTenant<RowDataPacket & { store_id: number }>(
      `SELECT store_id FROM ${scope.table} WHERE ${scope.noCol} = ? AND tenant_id = ?`,
      [params.orderNo, caller.tenantId],
      caller.tenantId,
    );
    if (!bill || Number(bill.store_id) !== Number(caller.storeId)) {
      throw new AppError("订单进度不存在", 404);
    }
  }

  const rows = await queryWithTenant<EventRow>(
    `SELECT * FROM t_order_progress_event
      WHERE tenant_id = ? AND order_family = ? AND order_no = ? AND progress_seq > ?
      ORDER BY progress_seq ASC
      LIMIT ?`,
    [caller.tenantId, family, params.orderNo, fromSeq, limit + 1],
    caller.tenantId,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const aiChannel = params.channel === "ai";
  const tokens = callerVisibilityTokens(caller);

  const events: ProgressEventView[] = [];
  for (const row of page) {
    if (aiChannel) {
      events.push(projectForAi(row));
    } else {
      const visible = parseJsonCol<string>(row.visible_to) ?? [];
      const allowed = visible.length === 0 || visible.some((t) => tokens.has(t));
      if (!allowed) continue;
      events.push(projectForHuman(row, caller));
    }
  }

  // 当前阶段 = 该单最大 seq 事件（主表真值以最新事件为准）
  const cur = await queryOneWithTenant<CurrentStageRow>(
    `SELECT progress_seq, business_stage, business_status FROM t_order_progress_event
      WHERE tenant_id = ? AND order_family = ? AND order_no = ?
      ORDER BY progress_seq DESC LIMIT 1`,
    [caller.tenantId, family, params.orderNo],
    caller.tenantId,
  );
  const lastSeqRow = await queryOneWithTenant<CurrentStageRow>(
    `SELECT COALESCE(MAX(progress_seq), 0) AS progress_seq FROM t_order_progress_event
      WHERE tenant_id = ? AND order_family = ? AND order_no = ?`,
    [caller.tenantId, family, params.orderNo],
    caller.tenantId,
  );

  const lastSeq = Number(lastSeqRow?.progress_seq ?? 0);
  const tail = page.length > 0 ? page[page.length - 1].progress_seq : fromSeq;
  return {
    order_no: params.orderNo,
    order_family: family,
    current_stage: cur?.business_stage ?? null,
    current_status: cur?.business_status ?? null,
    events,
    next_cursor: hasMore ? encodeCursor(tail) : null,
    has_more: hasMore,
    last_seq: lastSeq,
  };
}
