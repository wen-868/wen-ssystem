import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as purchasePlanController from "../controllers/admin/purchase-plan.controller";

export const purchasePlanRouter = Router();

purchasePlanRouter.get("/suggest", requireAuthWithTenant, purchasePlanController.suggestPurchasePlan);
purchasePlanRouter.post("/", requireAuthWithTenant, purchasePlanController.createPurchasePlan);
purchasePlanRouter.get("/", requireAuthWithTenant, purchasePlanController.listPurchasePlans);
purchasePlanRouter.post("/:planNo/convert", requireAuthWithTenant, purchasePlanController.convertPurchasePlan);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-plans",
  router: purchasePlanRouter,
  auth: "requireAuthWithTenant",
};
