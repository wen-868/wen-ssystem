import { Router } from "express";

import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingFullReductionRouter = Router();

// 满减活动管理
adminMarketingFullReductionRouter.post("/full-reductions", fullReductionController.createFullReduction);
adminMarketingFullReductionRouter.get("/full-reductions", fullReductionController.listFullReductions);
adminMarketingFullReductionRouter.get("/full-reductions/:id", fullReductionController.getFullReduction);
adminMarketingFullReductionRouter.put("/full-reductions/:id", fullReductionController.updateFullReduction);
adminMarketingFullReductionRouter.delete("/full-reductions/:id", fullReductionController.deleteFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/activate", fullReductionController.activateFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/pause", fullReductionController.pauseFullReduction);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFullReductionRouter,
  auth: "requireAuthWithTenant",
};