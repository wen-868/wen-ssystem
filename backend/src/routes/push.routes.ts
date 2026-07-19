/**
 * 推送Token路由
 *
 * 用途：App 端推送 Token 注册/查询/注销 + 测试推送
 * 路由前缀：/api/admin/push
 * 认证：requireAuthWithTenant（认证 + 租户隔离 + CSRF 防护）
 *
 * 路由列表：
 *   POST /register     注册/更新推送Token
 *   POST /unregister   注销推送Token
 *   GET  /tokens       查询当前用户的Token列表
 *   POST /test         发送测试推送（仅管理员角色）
 *
 * 关联任务：R51-07 后端推送通知服务
 */

import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as pushController from "../controllers/admin/push.controller";

export const pushRouter = Router();

pushRouter.use(requireAuthWithTenant);

// ==================== 推送 Token 路由 ====================

// 注册/更新推送Token
pushRouter.post("/register", pushController.registerToken);

// 注销推送Token
pushRouter.post("/unregister", pushController.unregisterToken);

// 查询当前用户的Token列表
pushRouter.get("/tokens", pushController.listTokens);

// 发送测试推送（仅管理员角色可用，controller 内部校验）
pushRouter.post("/test", pushController.sendTestPush);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/push",
    router: pushRouter,
    auth: "requireAuthWithTenant",
};
