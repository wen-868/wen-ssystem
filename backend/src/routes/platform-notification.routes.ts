import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-notification.controller";

/**
 * C6-2-T1：平台通知路由（3 条端点，路径由派单卡钉死，不得自拟/增减）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md 交付物②③
 * 单一前缀 /api/platform/notifications，auth = requirePlatformAuth（与既有平台路由同风格）。
 *
 * 注册顺序（卡内要求「字面量先于参数」）：字面量端点 `POST /read-all` 排在 `POST /:id/read` 之前。
 * 二者段数不同（1 段 vs 2 段），本不存在吞路径问题；仍按字面量优先排列，避免后续改动引入歧义。
 *
 * 本文件不写任何业务逻辑（分层规则：route 只注册）。
 * 各端点对应权限点见控制器头部注释（notification:view / notification:read）。
 */

export const platformNotificationRouter = Router();

// —— 字面量端点（先于 /:id/read）——
// GET /api/platform/notifications —— 通知列表（未读数由服务端按当前管理员计算）
platformNotificationRouter.get("/", asyncHandler(controller.listNotifications));
// POST /api/platform/notifications/read-all —— 当前管理员可见的全部未读一次性标记已读
platformNotificationRouter.post("/read-all", asyncHandler(controller.markAllNotificationsRead));

// —— 参数化端点 ——
// POST /api/platform/notifications/:id/read —— 标记该通知对当前管理员已读（幂等）
platformNotificationRouter.post("/:id/read", asyncHandler(controller.markNotificationRead));

export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/platform/notifications",
    router: platformNotificationRouter,
    auth: "requirePlatformAuth",
  },
];
