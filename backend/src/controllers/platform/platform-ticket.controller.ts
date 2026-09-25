import { z } from "zod";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import * as service from "../../services/platform/platform-ticket.service";

/**
 * C6-2-T7：平台工单系统控制器（10 条端点，路径由派单卡钉死）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md 交付物②③
 *   · GET  /api/platform/support/tickets                    → { groups, summary }        ← ticket:view（看板）
 *   · GET  /api/platform/support/tickets/:id                → 工单详情（不存在 404）      ← ticket:view
 *   · GET  /api/platform/support/tickets/:id/timeline        → { items }（平台视角）       ← ticket:view
 *   · POST /api/platform/support/tickets/:id/reply           → ticket:reply
 *   · POST /api/platform/support/tickets/:id/note            → ticket:note
 *   · POST /api/platform/support/tickets/:id/transfer        → ticket:transfer
 *   · POST /api/platform/support/tickets/:id/resolve         → ticket:resolve
 *   · POST /api/platform/support/tickets/:id/close           → ticket:close
 *   · GET  /api/platform/support/tickets/report              → { items: [], definitionPending: true } ← ticket:report
 *   · GET  /api/platform/support/ticket-categories           → { categories }            ← ticket:category:config
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ 由 errorHandler 统一转 400；
 * 业务错误（工单不存在 404 / 非法状态转移 400 / 缺管理员身份 401）由 service 或本控制器抛 AppError。
 * 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler（红线⑤）。
 * 权限点只以注释登记（service 层 TICKET_PERMISSIONS 常量给出取值），**本单不实现假鉴权**（红线⑤）。
 */

const ticketIdSchema = z.coerce.number().int().positive();

/** 状态筛选取值与迁移 180 / 服务层 TICKET_STATUSES 逐字一致（卡内钉死四态） */
const statusSchema = z.enum(["PENDING", "PROCESSING", "RESOLVED", "CLOSED"]);

/** 布尔 query 参数：axios 会把 boolean 序列化成 "true"/"false"，兼容 "1"/"0" */
const boolQuerySchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const listQuerySchema = z.object({
  onlyMine: boolQuerySchema.optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  // 卡内钉死 pageSize ≤ 100：超限显式 400（不静默夹取成 100）
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const contentBodySchema = z.object({
  // 卡内口径：content ≥1 字（trim 后为空的空白串同样按 400 处理）
  content: z.string().trim().min(1),
});

const transferBodySchema = z.object({
  assigneeId: z.coerce.number().int().positive(),
});

/** 当前平台管理员（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ 401（不静默造 id） */
function currentActor(req: any): service.TicketActor {
  const adminId = Number(req?.user?.id ?? 0);
  if (!adminId) {
    throw new AppError("缺少平台管理员身份", 401);
  }
  const adminName = req?.user?.realName ?? req?.user?.username ?? null;
  return { adminId, adminName: adminName === null ? null : String(adminName) };
}

/** GET /api/platform/support/tickets —— 看板列表（零数据 ⇒ 三组空数组 + 四态 0） */
export async function listTickets(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  const result = await service.listTicketBoard({
    onlyMine: query.onlyMine,
    adminId: Number(req?.user?.id ?? 0) || null,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  });
  res.json(ok(result));
}

/** GET /api/platform/support/tickets/:id —— 工单详情（不存在 ⇒ 404） */
export async function getTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  res.json(ok(await service.getTicketDetail(id)));
}

/**
 * GET /api/platform/support/tickets/:id/timeline —— 对话时间线（平台视角，含 PUBLIC/INTERNAL/TENANT）
 * 视角由本处**显式**传 "platform" 决定；service 层缺省即排除 INTERNAL（fail-safe）。
 */
export async function getTicketTimeline(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  res.json(ok(await service.listTimeline(id, "platform")));
}

/** POST /api/platform/support/tickets/:id/reply —— 公开回复（PENDING ⇒ 同时置 PROCESSING） */
export async function replyTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  const body = contentBodySchema.parse(req.body ?? {});
  res.json(ok(await service.replyToTicket(id, body.content, currentActor(req))));
}

/** POST /api/platform/support/tickets/:id/note —— 内部备注（不改状态） */
export async function noteTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  const body = contentBodySchema.parse(req.body ?? {});
  res.json(ok(await service.addInternalNote(id, body.content, currentActor(req))));
}

/** POST /api/platform/support/tickets/:id/transfer —— 转交（不改状态，只换受理人 + SYSTEM 留痕） */
export async function transferTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  const body = transferBodySchema.parse(req.body ?? {});
  res.json(ok(await service.transferTicket(id, body.assigneeId, currentActor(req))));
}

/** POST /api/platform/support/tickets/:id/resolve —— 标记已解决（RESOLVED/CLOSED ⇒ 400） */
export async function resolveTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  res.json(ok(await service.resolveTicket(id)));
}

/** POST /api/platform/support/tickets/:id/close —— 关闭工单（仅 RESOLVED ⇒ CLOSED） */
export async function closeTicket(req: any, res: any) {
  const id = ticketIdSchema.parse(req.params.id);
  res.json(ok(await service.closeTicket(id)));
}

/** GET /api/platform/support/tickets/report —— 服务报表（口径未定 ⇒ 显式空态） */
export async function getServiceReport(_req: any, res: any) {
  res.json(ok(service.getServiceReport()));
}

/** GET /api/platform/support/ticket-categories —— 工单类型配置列表（零预置 ⇒ categories: []） */
export async function listTicketCategories(_req: any, res: any) {
  res.json(ok(await service.listTicketCategories()));
}
