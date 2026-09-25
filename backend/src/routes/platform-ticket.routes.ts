import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-ticket.controller";

/**
 * C6-2-T7：平台工单系统路由（10 条端点，路径由派单卡钉死，不得自拟/增减）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md 交付物②（含"路由注册顺序（硬）"）
 * 单一前缀 /api/platform/support，全部挂 requirePlatformAuth（与既有平台路由同风格）。
 *
 * ★ 注册顺序（硬，卡内钉死）：字面量子路由 `/tickets/report` **必须**写在 `/tickets/:id` 之前，
 *   否则 `report` 会被 `:id` 吞掉并按参数校验失败返回 400。
 *   本文件在路由声明顺序上已按"字面量先于参数"排列；对应的反向验证见
 *   src/__tests__/routes/platform-ticket.test.ts 的「report 不被 :id 吞」用例。
 *
 * 本文件不写任何业务逻辑（分层规则：route 只注册）。
 * 各端点对应权限点见控制器头部注释（ticket:view / ticket:reply / ticket:note / ticket:transfer /
 * ticket:resolve / ticket:close / ticket:report / ticket:category:config）。
 */

export const platformSupportRouter = Router();

// —— 字面量子路由（必须先于 /tickets/:id）——
// GET /api/platform/support/tickets/report —— 服务报表（口径未定 ⇒ { items: [], definitionPending: true }）
platformSupportRouter.get("/tickets/report", asyncHandler(controller.getServiceReport));

// —— 字面量端点（与 /tickets/:id 段数不同，顺序无关，仍按"具体→通配"排列）——
// GET /api/platform/support/tickets —— 看板列表（groups + summary）
platformSupportRouter.get("/tickets", asyncHandler(controller.listTickets));
// GET /api/platform/support/ticket-categories —— 工单类型配置列表
platformSupportRouter.get("/ticket-categories", asyncHandler(controller.listTicketCategories));

// —— /tickets/:id 及其子路由 ——
// GET /api/platform/support/tickets/:id —— 工单详情
platformSupportRouter.get("/tickets/:id", asyncHandler(controller.getTicket));
// GET /api/platform/support/tickets/:id/timeline —— 对话时间线（平台视角）
platformSupportRouter.get("/tickets/:id/timeline", asyncHandler(controller.getTicketTimeline));
// POST /api/platform/support/tickets/:id/reply —— 公开回复
platformSupportRouter.post("/tickets/:id/reply", asyncHandler(controller.replyTicket));
// POST /api/platform/support/tickets/:id/note —— 内部备注
platformSupportRouter.post("/tickets/:id/note", asyncHandler(controller.noteTicket));
// POST /api/platform/support/tickets/:id/transfer —— 转交 / 改派
platformSupportRouter.post("/tickets/:id/transfer", asyncHandler(controller.transferTicket));
// POST /api/platform/support/tickets/:id/resolve —— 标记已解决
platformSupportRouter.post("/tickets/:id/resolve", asyncHandler(controller.resolveTicket));
// POST /api/platform/support/tickets/:id/close —— 关闭工单
platformSupportRouter.post("/tickets/:id/close", asyncHandler(controller.closeTicket));

export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/platform/support",
    router: platformSupportRouter,
    auth: "requirePlatformAuth",
  },
];
