import { Router } from "express";

import * as calculationController from "../controllers/admin/marketing-calculation.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingCalculationRouter = Router();

// 试算
adminMarketingCalculationRouter.post("/calculate", calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCalculationRouter,
  auth: "requireAuthWithTenant",
};