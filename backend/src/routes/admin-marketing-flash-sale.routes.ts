import { Router } from "express";

import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingFlashSaleRouter = Router();

// 秒杀活动管理
adminMarketingFlashSaleRouter.post("/flash-sales", requirePermission("sale:create"), flashSaleController.createFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales", flashSaleController.listFlashSales);
adminMarketingFlashSaleRouter.get("/flash-sales/:id", flashSaleController.getFlashSale);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：改 / 删秒杀活动挂 `sale:edit`（与本文件已接线的 4 条 `sale:create` 同族）。
// 使用者 = admin-web `marketing/FlashSale.vue:387/418`、`marketing/MarketingView.vue:542`
//（页面 `router/index.ts:228/:220` 角色 = SUPER_ADMIN）⇒ 生产持有 `sale:edit` = SUPER_ADMIN / OPERATION_ADMIN /
// STORE_MANAGER ⊇ {SUPER_ADMIN} ⇒ 零回归。2026-10-16
adminMarketingFlashSaleRouter.put("/flash-sales/:id", requirePermission("sale:edit"), flashSaleController.updateFlashSale);
adminMarketingFlashSaleRouter.delete("/flash-sales/:id", requirePermission("sale:edit"), flashSaleController.deleteFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/activate", requirePermission("sale:create"), flashSaleController.activateFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/pause", requirePermission("sale:create"), flashSaleController.pauseFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales/statistics", flashSaleController.getFlashSaleStatistics);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/grab", requirePermission("sale:create"), flashSaleController.buyFlashSale);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFlashSaleRouter,
  auth: "requireAuthWithTenant",
};
