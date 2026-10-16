import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as pointsMallController from "../controllers/admin/marketing-points-mall.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const marketingPointsMallRouter = Router();

// ==================== 积分商城 (Admin) ====================
// S3-226（第 43 项 B2 批 8 · 营销域接线）：积分商城 7 条写端点挂 `marketing:points`
//（台账 §三.4 域内建议码；`marketing:points` 为 079_权限矩阵.sql:165 既有 MENU 码）。
// 依据：admin-web `marketing/MarketingPointsMall.vue:454/451/342`（页面 `router/index.ts:224` 角色 = SUPER_ADMIN）；
// `DELETE /products/:id` 与兑换单 3 条（exchange / cancel / confirm）全仓无页面调用点；
// 生产持有 `marketing:points` = SUPER_ADMIN / OPERATION_ADMIN ⊇ {SUPER_ADMIN} ⇒ 零回归（app-mobile 仅 GET 调用）。
marketingPointsMallRouter.post("/products", requirePermission("marketing:points"), pointsMallController.createPointsProduct);
marketingPointsMallRouter.get("/products", pointsMallController.listPointsProducts);
marketingPointsMallRouter.get("/products/:id", pointsMallController.getPointsProductDetail);
marketingPointsMallRouter.put("/products/:id", requirePermission("marketing:points"), pointsMallController.updatePointsProduct);
marketingPointsMallRouter.delete("/products/:id", requirePermission("marketing:points"), pointsMallController.deletePointsProduct);
marketingPointsMallRouter.post("/products/:id/toggle", requirePermission("marketing:points"), pointsMallController.togglePointsProduct);
marketingPointsMallRouter.get("/exchange-records", pointsMallController.listExchangeRecords);
marketingPointsMallRouter.get("/exchange-records/:id", pointsMallController.getExchangeRecordDetail);
marketingPointsMallRouter.post("/exchange", requirePermission("marketing:points"), pointsMallController.exchangeProduct);
marketingPointsMallRouter.post("/exchange-records/:id/cancel", requirePermission("marketing:points"), pointsMallController.cancelExchange);
marketingPointsMallRouter.post("/exchange-records/:id/confirm", requirePermission("marketing:points"), pointsMallController.confirmExchange);
marketingPointsMallRouter.get("/stats", pointsMallController.getPointsMallStats);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/points-mall",
  router: marketingPointsMallRouter,
  auth: "requireAuthWithTenant",
};
