import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformPermission } from "../middleware/platform-rbac";
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
// 读端点不接权限码：通知列表属「当前管理员自己的收件箱」，不在卡 §三.3 的敏感读清单内 ⇒ 不接（避免误伤）。
platformNotificationRouter.get("/", asyncHandler(controller.listNotifications));
// POST /api/platform/notifications/read-all —— 当前管理员可见的全部未读一次性标记已读
// 写端点按卡 §三.2「所有 POST/PUT/PATCH/DELETE 默认 fail-closed」接权限码。
// 码的选择（如实披露）：通知域在平台侧目录 `PERMISSION_CATALOG` 里**没有**自己的写码
// （`services/platform/platform-notification.service.ts` 的 `PLATFORM_NOTIFICATION_PERMISSIONS`
//  只有 `notification:view` / `notification:read`，二者均未登记进平台权限码总表）⇒ 不扩目录的前提下
//  只能复用已登记的码；此处取 `ticket:reply`（工单域「对外回复」写动作，与"标记已读"同为轻量写操作）。
//  ⚠️ 该映射属**解释性决策**，已在回传卡 §七 与报告 §5.3 逐条登记，等门1/门2 复核；若裁定应扩
//  通知域写码，改动点是 `platform-role.service.ts` 的目录 + `platform-rbac.ts` 的写码表（两处同改）。
platformNotificationRouter.post("/read-all", requirePlatformPermission("ticket:reply"), asyncHandler(controller.markAllNotificationsRead));

// —— 参数化端点 ——
// POST /api/platform/notifications/:id/read —— 标记该通知对当前管理员已读（幂等）
platformNotificationRouter.post("/:id/read", requirePlatformPermission("ticket:reply"), asyncHandler(controller.markNotificationRead));

export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/platform/notifications",
    router: platformNotificationRouter,
    auth: "requirePlatformAuth",
  },
];
