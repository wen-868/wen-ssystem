import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as retailAnnouncementsAdminController from "../controllers/admin/retail-announcements-admin.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const retailAnnouncementsAdminRouter = Router();

// 公告管理（admin-web 前端契约：/api/admin/retail-announcements）
retailAnnouncementsAdminRouter.get("/", retailAnnouncementsAdminController.listAnnouncements);
// S3-226（第 43 项 B2 批 8 · 营销域接线）：公告增/改/删 3 条挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `instant-retail/RetailAnnouncement.vue:203/200/224`（页面 `router/index.ts:189` 角色 = SUPER_ADMIN）；
// `DELETE` 全仓无页面调用点；生产持有 `marketing:create` ⊇ {SUPER_ADMIN} ⇒ 零回归。
// ⚠️ 语义备注：公告并非营销活动，此处按台账 §三.4 的域内建议码落地，已在回执 §差异 登记待裁定。
retailAnnouncementsAdminRouter.post("/", requirePermission("marketing:create"), retailAnnouncementsAdminController.createAnnouncement);
retailAnnouncementsAdminRouter.put("/:id", requirePermission("marketing:create"), retailAnnouncementsAdminController.updateAnnouncement);
retailAnnouncementsAdminRouter.delete("/:id", requirePermission("marketing:create"), retailAnnouncementsAdminController.deleteAnnouncement);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/retail-announcements",
  router: retailAnnouncementsAdminRouter,
  auth: "requireAuthWithTenant",
};
