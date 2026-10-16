import { Router } from "express";

import * as pointsController from "../controllers/admin/marketing-points.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingPointsRouter = Router();

// 积分管理
adminMarketingPointsRouter.get("/points/rule", pointsController.getPointsRule);
// S3-226（第 43 项 B2 批 8 · 营销域接线）：积分规则修改挂 `marketing:points`
//（台账 §三.4 域内建议码；`marketing:points` 为 079_权限矩阵.sql:165 既有 MENU 码）。
// 依据：全仓**无任何调用点**（admin-web `api/marketing.ts` 无 `/points/rule`；app-mobile 零命中）
// ⇒ 使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN}，与 `marketing:points` 持有人一致 ⇒ 零回归。
adminMarketingPointsRouter.put("/points/rule", requirePermission("marketing:points"), pointsController.updatePointsRule);
adminMarketingPointsRouter.get("/points/records", pointsController.listPointsRecords);
adminMarketingPointsRouter.get("/points/user/:userId", pointsController.getUserPoints);
adminMarketingPointsRouter.get("/points/my-records", pointsController.listMyPointsRecords);
adminMarketingPointsRouter.get("/points/detail", pointsController.getPointsRecords);
// ⚠️ `POST /points/redeem` 本批**不接**：app-mobile 积分兑换页有真实写调用点
//（`pages-sub/marketing/points/points-exchange.vue:88` → `api/modules/points.ts:68`），而该页 `pages.json` 注册后
// 全仓**无导航入口**（孤岛页）⇒ 使用者集合不可枚举（B 类，见台账 §十五.5）。
adminMarketingPointsRouter.post("/points/redeem", pointsController.createPointsRedeem);
adminMarketingPointsRouter.get("/points/stats", pointsController.getPointsStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingPointsRouter,
  auth: "requireAuthWithTenant",
};