import { Router } from "express";

import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingFlashSaleRouter = Router();

// 秒杀活动管理
adminMarketingFlashSaleRouter.post("/flash-sales", requirePermission("sale:create"), flashSaleController.createFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales", flashSaleController.listFlashSales);
adminMarketingFlashSaleRouter.get("/flash-sales/:id", flashSaleController.getFlashSale);
adminMarketingFlashSaleRouter.put("/flash-sales/:id", flashSaleController.updateFlashSale);
adminMarketingFlashSaleRouter.delete("/flash-sales/:id", flashSaleController.deleteFlashSale);
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