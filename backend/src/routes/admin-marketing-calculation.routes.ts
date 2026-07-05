import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as calculationController from "../controllers/admin/marketing-calculation.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

export const adminMarketingCalculationRouter = Router();

// 试算
adminMarketingCalculationRouter.post("/calculate", requireAuthWithTenant, calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCalculationRouter,
  auth: "none",
};