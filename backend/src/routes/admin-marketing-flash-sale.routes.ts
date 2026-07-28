import { Router } from "express";

import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingFlashSaleRouter = Router();

// 秒杀活动管理
adminMarketingFlashSaleRouter.post("/flash-sales", flashSaleController.createFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales", flashSaleController.listFlashSales);
adminMarketingFlashSaleRouter.get("/flash-sales/:id", flashSaleController.getFlashSale);
adminMarketingFlashSaleRouter.put("/flash-sales/:id", flashSaleController.updateFlashSale);
adminMarketingFlashSaleRouter.delete("/flash-sales/:id", flashSaleController.deleteFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/activate", flashSaleController.activateFlashSale);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/pause", flashSaleController.pauseFlashSale);
adminMarketingFlashSaleRouter.get("/flash-sales/statistics", flashSaleController.getFlashSaleStatistics);
adminMarketingFlashSaleRouter.post("/flash-sales/:id/grab", flashSaleController.buyFlashSale);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFlashSaleRouter,
  auth: "requireAuthWithTenant",
};