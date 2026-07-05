import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as pointsController from "../controllers/admin/marketing-points.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

export const adminMarketingPointsRouter = Router();

// 积分管理
adminMarketingPointsRouter.get("/points/rule", requireAuthWithTenant, pointsController.getPointsRule);
adminMarketingPointsRouter.put("/points/rule", requireAuthWithTenant, pointsController.updatePointsRule);
adminMarketingPointsRouter.get("/points/records", requireAuthWithTenant, pointsController.listPointsRecords);
adminMarketingPointsRouter.get("/points/user/:userId", requireAuthWithTenant, pointsController.getUserPoints);
adminMarketingPointsRouter.get("/points/my-records", requireAuthWithTenant, pointsController.listMyPointsRecords);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingPointsRouter,
  auth: "none",
};