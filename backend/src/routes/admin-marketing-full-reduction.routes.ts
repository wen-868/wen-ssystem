import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingFullReductionRouter = Router();

// 满减活动管理
adminMarketingFullReductionRouter.post("/full-reductions", requireAuthWithTenant, fullReductionController.createFullReduction);
adminMarketingFullReductionRouter.get("/full-reductions", requireAuthWithTenant, fullReductionController.listFullReductions);
adminMarketingFullReductionRouter.get("/full-reductions/:id", requireAuthWithTenant, fullReductionController.getFullReduction);
adminMarketingFullReductionRouter.put("/full-reductions/:id", requireAuthWithTenant, fullReductionController.updateFullReduction);
adminMarketingFullReductionRouter.delete("/full-reductions/:id", requireAuthWithTenant, fullReductionController.deleteFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/activate", requireAuthWithTenant, fullReductionController.activateFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/pause", requireAuthWithTenant, fullReductionController.pauseFullReduction);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFullReductionRouter,
  auth: "requireAuthWithTenant",
};