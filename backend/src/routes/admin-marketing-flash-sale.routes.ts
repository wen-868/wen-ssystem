import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingFlashSaleRouter = Router();

// 秒杀活动管理
adminMarketingFlashSaleRouter.post("/flash-sales", requireAuthWithTenant, flashSaleController.createFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales", requireAuthWithTenant, flashSaleController.listFlashSales);
adminMarketingFlashSaleRouter.get("/flash-sales/:id", requireAuthWithTenant, flashSaleController.getFlashSale);
adminMarketingFlashSaleRouter.put("/flash-sales/:id", requireAuthWithTenant, flashSaleController.updateFlashSale);
adminMarketingFlashSaleRouter.delete("/flash-sales/:id", requireAuthWithTenant, flashSaleController.deleteFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/activate", requireAuthWithTenant, flashSaleController.activateFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/pause", requireAuthWithTenant, flashSaleController.pauseFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales/statistics", requireAuthWithTenant, flashSaleController.getFlashSaleStatistics);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/grab", requireAuthWithTenant, flashSaleController.buyFlashSale);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFlashSaleRouter,
  auth: "requireAuthWithTenant",
};