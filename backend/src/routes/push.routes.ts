/**
 * 推送Token路由
 *
 * 用途：App 端推送 Token 注册/查询/注销 + 测试推送
 * 路由前缀：/api/admin/push
 * 认证：requireAuthWithTenant（认证 + 租户隔离 + CSRF 防护，由 auto-routes 统一添加）
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
import { requirePermission } from "../middleware/rbac-auth";
import { PERM_SYSTEM_PUSH_TEST } from "../shared/system-permission-codes";
import * as pushController from "../controllers/admin/push.controller";

export const pushRouter = Router();

// ==================== 推送 Token 路由 ====================

// 注册/更新推送Token
pushRouter.post("/register", pushController.registerToken);

// 注销推送Token
pushRouter.post("/unregister", pushController.unregisterToken);

// 查询当前用户的Token列表
pushRouter.get("/tokens", pushController.listTokens);

// 发送测试推送（S3-237 接线批 10 · 组 1「系统设置/基础域」：挂 S3-232 已立的新码 `system:push:test`）
// ⚠️ 与控制器内既有角色硬校验（`controllers/admin/push.controller.ts:118` = SUPER_ADMIN/OPERATION_ADMIN/BOSS）的对齐：
//   · 码的持有者（`*` 通配 ⇒ SUPER_ADMIN / OPERATION_ADMIN）**⊆** 控制器白名单 ⇒ 不会出现"码放行、控制器仍 403"的空转；
//   · 白名单里多出的 `BOSS` 在生产 `t_sys_role` 里**不存在**（生产底稿 12 个角色无 BOSS）⇒ 没有在用账号被新门拦下；
//   · 其余角色（店长/操作员等）在接线前就被控制器 403，接线后 403 的层次前移、状态码不变 ⇒ 无回归。
// 逐条对齐的机器证据见 `rbac-b2-s3-237-system-wiring.test.ts`（持有者集合 × 白名单三重断言）。
pushRouter.post("/test", requirePermission(PERM_SYSTEM_PUSH_TEST), pushController.sendTestPush);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/push",
    router: pushRouter,
    auth: "requireAuthWithTenant",
};
