import { query, queryOne, transaction, connExecute } from "../../shared/db";
import { normalizePagination, calculateOffset } from "../../shared/pagination";
import type { ResultSetHeader } from "mysql2";
import { AppError } from "../../shared/app-error";

/**
 * C6-2-T7：平台工单系统服务（t_support_ticket / t_support_ticket_message /
 * t_support_ticket_attachment / t_support_ticket_category）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md（交付物②③④、验收标准②⑤⑦⑧）
 *       + docs/tasks/cards/R101-C6-2-批1-立项卡-T6+T7.md §四（状态机、会话语义）、§五（SLA/报表口径未定）
 *
 * 口径（逐条可核对）：
 * - 平台级表（除工单主表的 tenant_id 表示"工单归属租户"外，均无租户过滤语义）：用 query()/queryOne()，
 *   不走 queryWithTenant（不注入 tenant_id 条件）；
 * - 零假数据：所有返回值都来自真实查询，空表一律返回空态（groups 三键空数组 / items: [] / categories: []），
 *   不写隐式种子、不硬编码示例工单；
 * - 状态机：PENDING → PROCESSING（首条公开回复）→ RESOLVED（resolve）→ CLOSED（close）；
 *   非法转移一律显式抛 400（AppError），**不静默忽略、不静默成功**；
 *   转交（transfer）**不改状态**，只换 assignee_id 并写一条 SYSTEM 留痕；
 * - 公/私隔离：`listTimeline(ticketId, viewer)` 的可见性由**显式参数**决定，
 *   **只有 viewer === "platform" 才包含 INTERNAL**；缺省/其它取值一律按最小可见性（排除 INTERNAL）——
 *   fail-safe 默认，后续任何调用方都无法"忘了传参就泄漏内部备注"；
 * - SLA 不计算：sla_hours 只作配置字段保留，sla_deadline 保持 NULL（口径未定，禁止近似值）；
 * - 服务报表口径未定：返回 `{ items: [], definitionPending: true }`（显式空态，不用 COUNT 硬凑报表）。
 */

/**
 * 工单域权限点常量（交付物④）：取值与 T6 的权限点目录 `PERMISSION_CATALOG` 的 ticket 域 BUTTON 项
 * **逐字一致**（backend/src/services/platform/platform-role.service.ts）；本文件只在端点处用注释声明对应权限点，
 * **不实现按角色的强制鉴权**——T6 只有"角色 + 权限矩阵"，没有 admin↔role 绑定表，无法判定当前管理员角色，
 * 写一个"永远放行的权限校验"即为假校验（本单红线⑤）。
 */
export const TICKET_PERMISSIONS = {
  reply: "ticket:reply",
  note: "ticket:note",
  transfer: "ticket:transfer",
  resolve: "ticket:resolve",
  close: "ticket:close",
  report: "ticket:report",
  categoryConfig: "ticket:category:config",
} as const;

/** 工单状态四态（与迁移 180 的 status 列口径、控制器 status 过滤器逐字一致） */
export const TICKET_STATUSES = ["PENDING", "PROCESSING", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** 气泡类型三态（PUBLIC-公开回复 / INTERNAL-内部备注 / TENANT-租户消息） */
export const TICKET_BUBBLE_TYPES = ["PUBLIC", "INTERNAL", "TENANT"] as const;
export type TicketBubbleType = (typeof TICKET_BUBBLE_TYPES)[number];

/** 内部备注的 bubble_type 取值（隔离判定的唯一依据） */
export const INTERNAL_BUBBLE: TicketBubbleType = "INTERNAL";

/** 时间线视角：本期只有平台视角（本批无租户侧工单接口） */
export type TicketTimelineViewer = "platform";

export interface TicketCard {
  id: number;
  ticketNo: string;
  tenantId: string;
  categoryId: number;
  title: string;
  priority: string;
  status: string;
  assigneeId: number | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TicketDetail extends TicketCard {
  description: string | null;
  resolvedAt: unknown;
  closedAt: unknown;
}

export interface TicketTimelineItem {
  id: number;
  senderType: string;
  senderName: string | null;
  bubbleType: string;
  content: string;
  createdAt: unknown;
}

export interface TicketBoardQuery {
  /** true ⇒ 只看当前管理员受理的工单（assignee_id = adminId） */
  onlyMine?: boolean;
  /** 当前平台管理员 ID（requirePlatformAuth 解码出的 admin.id）；onlyMine=true 时必填 */
  adminId?: number | null;
  /** 单状态精确筛选（PENDING/PROCESSING/RESOLVED/CLOSED） */
  status?: TicketStatus;
  page?: number;
  pageSize?: number;
}

export interface TicketBoard {
  groups: {
    pending: TicketCard[];
    processing: TicketCard[];
    resolved: TicketCard[];
  };
  summary: {
    pending: number;
    processing: number;
    resolved: number;
    closed: number;
  };
}

export interface TicketCategoryItem {
  id: number;
  name: string;
  slug: string;
  slaHours: number;
  sortNo: number;
  enabled: boolean;
}

export interface TicketActor {
  /** 平台管理员 ID（写入 sender_id） */
  adminId: number;
  /** 平台管理员名称（写入 sender_name；缺省记 NULL，不编造） */
  adminName?: string | null;
}

/**
 * 服务报表（GET /api/platform/support/tickets/report）
 * 报表口径未定（立项卡 §五.2）⇒ 显式空态 + definitionPending 标记，**不返回近似指标**。
 */
export interface TicketServiceReport {
  items: unknown[];
  definitionPending: boolean;
}

interface TicketRow {
  id: number;
  ticketNo: string;
  tenantId: string;
  categoryId: number | string;
  title: string;
  priority: string;
  status: string;
  assigneeId: number | null;
  createdAt: unknown;
  updatedAt: unknown;
  description?: string | null;
  resolvedAt?: unknown;
  closedAt?: unknown;
}

interface TicketStateRow {
  id: number;
  status: string;
  assigneeId: number | null;
}

interface MessageRow {
  id: number;
  senderType: string;
  senderName: string | null;
  bubbleType: string;
  content: string;
  createdAt: unknown;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  slaHours: number | string;
  sortNo: number | string;
  enabled: number | boolean;
}

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toCard(row: TicketRow): TicketCard {
  // 卡内硬口径：TicketCard **不含 tenantName**（不 JOIN t_tenant，避免按臆想表结构写）
  return {
    id: Number(row.id),
    ticketNo: String(row.ticketNo),
    tenantId: String(row.tenantId),
    categoryId: Number(row.categoryId),
    title: String(row.title),
    priority: String(row.priority),
    status: String(row.status),
    assigneeId: row.assigneeId === null || row.assigneeId === undefined ? null : Number(row.assigneeId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeContent(content: string): string {
  const trimmed = String(content ?? "").trim();
  if (trimmed.length === 0) {
    throw new AppError("消息内容不能为空", 400);
  }
  return trimmed;
}

/** 工单卡片列（三处查询共用同一份列口径，避免字段名漂移） */
const CARD_COLUMNS = `id AS id, ticket_no AS ticketNo, tenant_id AS tenantId, category_id AS categoryId,
            title AS title, priority AS priority, status AS status, assignee_id AS assigneeId,
            created_at AS createdAt, updated_at AS updatedAt`;

/** 工单不存在 ⇒ 404（读 status 供状态机判定，读 assignee_id 供转交留痕用，避免二次查询） */
async function requireTicket(id: number): Promise<TicketStateRow> {
  const row = await queryOne<TicketStateRow>(
    "SELECT id AS id, status AS status, assignee_id AS assigneeId FROM t_support_ticket WHERE id = ?",
    [id]
  );
  if (!row) {
    throw new AppError(`工单不存在：${id}`, 404);
  }
  return row;
}

/**
 * 看板列表（GET /api/platform/support/tickets）
 *
 * 分组口径（卡内钉死）：groups 只含 pending / processing / resolved 三键；
 * summary 含四态计数（含 closed）。
 * 分页口径：page/pageSize **对每个分组各自生效**（看板是三列，不是一张表）；
 *   卡只钉了默认值与上限（默认 1 / 20，≤100），未钉"分页作用于哪个集合"，此处按"每组各取当前页"落地；
 *   summary 为**全量计数**（不受分页影响，只受 onlyMine 作用域影响）。
 * status 精确筛选：只填充被筛中的那一组（其余两组为空数组），summary 仍为四态全量计数，便于看板显示上下文。
 * onlyMine=true 但拿不到管理员身份 ⇒ 显式 400（不做"忽略过滤条件"的静默降级）。
 */
export async function listTicketBoard(input: TicketBoardQuery = {}): Promise<TicketBoard> {
  const onlyMine = input.onlyMine === true;
  if (onlyMine && !input.adminId) {
    throw new AppError("onlyMine 需要当前管理员身份", 400);
  }
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const offset = calculateOffset(page, pageSize);

  const groups: TicketBoard["groups"] = { pending: [], processing: [], resolved: [] };
  const statusToGroup: Array<[keyof TicketBoard["groups"], TicketStatus]> = [
    ["pending", "PENDING"],
    ["processing", "PROCESSING"],
    ["resolved", "RESOLVED"],
  ];

  for (const [groupKey, status] of statusToGroup) {
    // status 精确筛选：未被筛中的分组不查库、保持空数组（诚实空态）
    if (input.status && input.status !== status) continue;
    const params: unknown[] = [status];
    let where = "WHERE status = ?";
    if (onlyMine) {
      where += " AND assignee_id = ?";
      params.push(Number(input.adminId));
    }
    params.push(pageSize, offset);
    const rows = await query(
      `SELECT ${CARD_COLUMNS}
         FROM t_support_ticket
         ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      params
    );
    groups[groupKey] = rowsOf<TicketRow>(rows).map(toCard);
  }

  const summaryWhere = onlyMine ? "WHERE assignee_id = ?" : "";
  const summaryRows = rowsOf<{ status: string; cnt: number | string }>(
    await query(
      `SELECT status AS status, COUNT(*) AS cnt
         FROM t_support_ticket
         ${summaryWhere}
        GROUP BY status`,
      onlyMine ? [Number(input.adminId)] : []
    )
  );
  const countByStatus = new Map<string, number>();
  for (const row of summaryRows) {
    countByStatus.set(String(row.status), Number(row.cnt ?? 0));
  }

  return {
    groups,
    summary: {
      pending: countByStatus.get("PENDING") ?? 0,
      processing: countByStatus.get("PROCESSING") ?? 0,
      resolved: countByStatus.get("RESOLVED") ?? 0,
      closed: countByStatus.get("CLOSED") ?? 0,
    },
  };
}

/** 工单详情（GET /api/platform/support/tickets/:id）：不存在 ⇒ 404 */
export async function getTicketDetail(id: number): Promise<TicketDetail> {
  const row = await queryOne<TicketRow>(
    `SELECT ${CARD_COLUMNS},
            description AS description, resolved_at AS resolvedAt, closed_at AS closedAt
       FROM t_support_ticket
      WHERE id = ?`,
    [id]
  );
  if (!row) {
    throw new AppError(`工单不存在：${id}`, 404);
  }
  return {
    ...toCard(row),
    description: row.description === undefined || row.description === null ? null : String(row.description),
    resolvedAt: row.resolvedAt ?? null,
    closedAt: row.closedAt ?? null,
  };
}

/**
 * 工单时间线（GET /api/platform/support/tickets/:id/timeline）
 *
 * **公/私隔离的唯一入口**（交付物③）：`viewer` 必须显式传参，只有 `"platform"` 视角包含 INTERNAL；
 * 未传 / 传其它值 ⇒ 按最小可见性（排除 INTERNAL）处理 —— fail-safe 默认，
 * 后续新增的任何调用方都不可能因为"忘记传参"而把内部备注泄漏给租户侧。
 *
 * `viewer` 在类型上标为可选是为了让"缺省即最小可见"成为可测行为（缺省视角的单测即针对此分支），
 * 调用方（控制器）必须显式传 "platform"。
 */
export async function listTimeline(
  ticketId: number,
  viewer?: TicketTimelineViewer
): Promise<{ items: TicketTimelineItem[] }> {
  const includeInternal = viewer === "platform";
  await requireTicket(ticketId);

  const rows = await query(
    `SELECT id AS id, sender_type AS senderType, sender_name AS senderName,
            bubble_type AS bubbleType, content AS content, created_at AS createdAt
       FROM t_support_ticket_message
      WHERE ticket_id = ?${includeInternal ? "" : " AND bubble_type <> ?"}
      ORDER BY created_at ASC, id ASC`,
    includeInternal ? [ticketId] : [ticketId, INTERNAL_BUBBLE]
  );
  const items = rowsOf<MessageRow>(rows).map((row) => ({
    id: Number(row.id),
    senderType: String(row.senderType),
    senderName: row.senderName === null || row.senderName === undefined ? null : String(row.senderName),
    bubbleType: String(row.bubbleType),
    content: String(row.content),
    createdAt: row.createdAt,
  }));
  return { items };
}

/**
 * 公开回复（POST /api/platform/support/tickets/:id/reply）—— 权限点 ticket:reply
 * 写一条 bubble_type='PUBLIC' / sender_type='PLATFORM' 的消息；当前状态为 PENDING ⇒ 同时置 PROCESSING。
 * 工单不存在 ⇒ 404（不静默成功）。
 */
export async function replyToTicket(
  ticketId: number,
  content: string,
  actor: TicketActor
): Promise<{ id: number; messageId: number; status: TicketStatus }> {
  const ticket = await requireTicket(ticketId);
  const text = normalizeContent(content);
  const promote = ticket.status === "PENDING";

  const messageId = await transaction(async (conn) => {
    const [result] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_support_ticket_message
         (ticket_id, sender_type, sender_id, sender_name, bubble_type, content, created_at)
       VALUES (?, 'PLATFORM', ?, ?, 'PUBLIC', ?, NOW())`,
      [ticketId, String(actor.adminId), actor.adminName ?? null, text]
    );
    if (promote) {
      await connExecute<ResultSetHeader>(
        conn,
        "UPDATE t_support_ticket SET status = 'PROCESSING', updated_at = NOW() WHERE id = ?",
        [ticketId]
      );
    }
    return result.insertId;
  });

  return {
    id: ticketId,
    messageId: Number(messageId),
    status: promote ? "PROCESSING" : (ticket.status as TicketStatus),
  };
}

/**
 * 内部备注（POST /api/platform/support/tickets/:id/note）—— 权限点 ticket:note
 * 写一条 bubble_type='INTERNAL' / sender_type='PLATFORM' 的消息；**不改状态**。
 */
export async function addInternalNote(
  ticketId: number,
  content: string,
  actor: TicketActor
): Promise<{ id: number; messageId: number; status: TicketStatus }> {
  const ticket = await requireTicket(ticketId);
  const text = normalizeContent(content);

  const messageId = await transaction(async (conn) => {
    const [result] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_support_ticket_message
         (ticket_id, sender_type, sender_id, sender_name, bubble_type, content, created_at)
       VALUES (?, 'PLATFORM', ?, ?, 'INTERNAL', ?, NOW())`,
      [ticketId, String(actor.adminId), actor.adminName ?? null, text]
    );
    return result.insertId;
  });

  return { id: ticketId, messageId: Number(messageId), status: ticket.status as TicketStatus };
}

/**
 * 转交 / 改派（POST /api/platform/support/tickets/:id/transfer）—— 权限点 ticket:transfer
 * **不改状态**：只换 assignee_id，并写一条 bubble_type='INTERNAL' / sender_type='SYSTEM' 的留痕消息。
 * 留痕内容只用受理人 ID（不查 t_platform_admin 取名，避免引入未核定的列依赖）。
 */
export async function transferTicket(
  ticketId: number,
  assigneeId: number,
  actor: TicketActor
): Promise<{ id: number; assigneeId: number; status: TicketStatus }> {
  const ticket = await requireTicket(ticketId);
  const previousAssignee = ticket.assigneeId === null ? "未分配" : String(ticket.assigneeId);
  const nextAssignee = Number(assigneeId);

  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_support_ticket SET assignee_id = ?, updated_at = NOW() WHERE id = ?",
      [nextAssignee, ticketId]
    );
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_support_ticket_message
         (ticket_id, sender_type, sender_id, sender_name, bubble_type, content, created_at)
       VALUES (?, 'SYSTEM', ?, ?, 'INTERNAL', ?, NOW())`,
      [
        ticketId,
        String(actor.adminId),
        actor.adminName ?? null,
        `工单已转交：受理人 ${previousAssignee} → ${nextAssignee}`,
      ]
    );
  });

  return { id: ticketId, assigneeId: nextAssignee, status: ticket.status as TicketStatus };
}

/**
 * 标记已解决（POST /api/platform/support/tickets/:id/resolve）—— 权限点 ticket:resolve
 * 允许 PENDING|PROCESSING → RESOLVED（写 resolved_at）；RESOLVED|CLOSED ⇒ 显式 400。
 */
export async function resolveTicket(ticketId: number): Promise<{ id: number; status: TicketStatus }> {
  const ticket = await requireTicket(ticketId);
  if (ticket.status !== "PENDING" && ticket.status !== "PROCESSING") {
    throw new AppError(`当前状态不允许标记已解决：${ticket.status}`, 400);
  }
  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_support_ticket SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
      [ticketId]
    );
  });
  return { id: ticketId, status: "RESOLVED" };
}

/**
 * 关闭工单（POST /api/platform/support/tickets/:id/close）—— 权限点 ticket:close
 * 允许 RESOLVED → CLOSED（写 closed_at）；其它状态（含重复关闭）⇒ 显式 400。
 */
export async function closeTicket(ticketId: number): Promise<{ id: number; status: TicketStatus }> {
  const ticket = await requireTicket(ticketId);
  if (ticket.status !== "RESOLVED") {
    throw new AppError(`当前状态不允许关闭工单：${ticket.status}`, 400);
  }
  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_support_ticket SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW() WHERE id = ?",
      [ticketId]
    );
  });
  return { id: ticketId, status: "CLOSED" };
}

/**
 * 服务报表（GET /api/platform/support/tickets/report）—— 权限点 ticket:report
 * 报表口径未定（立项卡 §五.2）⇒ 显式空态 + definitionPending，**不查库、不用 COUNT 冒充报表**。
 */
export function getServiceReport(): TicketServiceReport {
  return { items: [], definitionPending: true };
}

/**
 * 工单类型配置列表（GET /api/platform/support/ticket-categories）—— 权限点 ticket:category:config
 * 零预置 ⇒ 空表返回 `{ categories: [] }`（不造内置类型）。
 */
export async function listTicketCategories(): Promise<{ categories: TicketCategoryItem[] }> {
  const rows = await query(
    `SELECT id AS id, name AS name, slug AS slug, sla_hours AS slaHours,
            sort_no AS sortNo, enabled AS enabled
       FROM t_support_ticket_category
      ORDER BY sort_no ASC, id ASC`
  );
  const categories = rowsOf<CategoryRow>(rows).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    slaHours: Number(row.slaHours ?? 0),
    sortNo: Number(row.sortNo ?? 0),
    enabled: Number(row.enabled ?? 0) === 1,
  }));
  return { categories };
}
