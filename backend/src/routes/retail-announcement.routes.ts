/**
 * 即时零售公告路由
 *
 * 路由前缀：/api/retail-announcement
 * 认证策略：
 *   - admin 路由：requireAuthWithTenant（认证 + 租户隔离）+ csrfMiddleware（CSRF 防护）
 *   - miniapp 路由：公开（消费者无登录，公告为公开信息）
 *
 * 安全说明（R55-01）：
 *   原路由使用 requireAuth（不含 tenantMiddleware），导致跨租户数据泄露。
 *   现改为 requireAuthWithTenant，service 层所有 SQL 注入 tenant_id 过滤条件。
 *
 * 关联任务：R55-01 retail-announcement 跨租户数据泄露修复
 */

import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requirePermission } from "../middleware/rbac-auth";
import * as retailAnnouncementController from "../controllers/admin/retail-announcement.controller";

export const retailAnnouncementRouter = Router();

// ==================== miniapp 公开路由（无认证，消费者按门店查看公告） ====================
retailAnnouncementRouter.get("/miniapp/retail-announcements", retailAnnouncementController.getActiveAnnouncements);

// ==================== admin 路由（认证 + 租户隔离 + CSRF 防护） ====================
// 统一挂载 requireAuthWithTenant（含 requireAuth + tenantMiddleware）+ csrfMiddleware
// 写法说明：参考 print.routes.ts / inventory-batch.routes.ts 等已有路由，
// router.use 直接接受 RequestHandler[] 数组（requireAuthWithTenant 即为数组）。
// 不使用 spread（...requireAuthWithTenant）是因为在 vitest mock 场景下，
// mock 替换 requireAuthWithTenant 为单个函数时 spread 会失败（function is not iterable）。
// 分两步挂载中间件：先认证+租户隔离，再 CSRF 防护
retailAnnouncementRouter.use("/admin", requireAuthWithTenant);
retailAnnouncementRouter.use("/admin", csrfMiddleware);

retailAnnouncementRouter.get("/admin/retail-announcements", retailAnnouncementController.listAnnouncements);
// S3-226（第 43 项 B2 批 8 · 营销域接线）：公告增/改/删 3 条挂 `marketing:create`（台账 §三.4 域内建议码）。
// 顺序：认证（`router.use("/admin", …)`）→ CSRF（同处）→ 权限（本行内联）⇒ 符合「认证 → CSRF → 权限」铁律。
// 依据：admin-web 侧 **无有效调用点**（`api/instant-retail.ts:262-274` 打的是 `/admin/retail-announcements`，
// 命中 `retail-announcements-admin.routes.ts`，不是本文件的 `/api/retail-announcement/admin/...`）；
// 使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归。
retailAnnouncementRouter.post("/admin/retail-announcements", requirePermission("marketing:create"), retailAnnouncementController.createAnnouncement);
retailAnnouncementRouter.put("/admin/retail-announcements/:id", requirePermission("marketing:create"), retailAnnouncementController.updateAnnouncement);
retailAnnouncementRouter.delete("/admin/retail-announcements/:id", requirePermission("marketing:create"), retailAnnouncementController.deleteAnnouncement);

// ========== 路由自动发现配置 ==========
// auth:"none" — admin 子路径已在 router.use("/admin", ...) 内部手动挂载中间件
// 避免与 auto-routes 的全局认证中间件形成双重注册（踩坑[69]）
export const routeConfig: RouteConfig = {
  prefix: "/api/retail-announcement",
  router: retailAnnouncementRouter,
  auth: "none",
};
