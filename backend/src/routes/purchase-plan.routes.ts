import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as purchasePlanController from "../controllers/admin/purchase-plan.controller";

export const purchasePlanRouter = Router();

purchasePlanRouter.get("/suggest", purchasePlanController.suggestPurchasePlan);
purchasePlanRouter.post("/", purchasePlanController.createPurchasePlan);
purchasePlanRouter.get("/", purchasePlanController.listPurchasePlans);
purchasePlanRouter.post("/:planNo/convert", purchasePlanController.convertPurchasePlan);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-plans",
  router: purchasePlanRouter,
  auth: "requireAuthWithTenant",
};
