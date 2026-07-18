import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as pointsController from "../controllers/admin/marketing-points.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingPointsRouter = Router();

// 积分管理
adminMarketingPointsRouter.get("/points/rule", requireAuthWithTenant, pointsController.getPointsRule);
adminMarketingPointsRouter.put("/points/rule", requireAuthWithTenant, pointsController.updatePointsRule);
adminMarketingPointsRouter.get("/points/records", requireAuthWithTenant, pointsController.listPointsRecords);
adminMarketingPointsRouter.get("/points/user/:userId", requireAuthWithTenant, pointsController.getUserPoints);
adminMarketingPointsRouter.get("/points/my-records", requireAuthWithTenant, pointsController.listMyPointsRecords);
adminMarketingPointsRouter.get("/points/detail", requireAuthWithTenant, pointsController.getPointsRecords);
adminMarketingPointsRouter.post("/points/redeem", requireAuthWithTenant, pointsController.createPointsRedeem);
adminMarketingPointsRouter.get("/points/stats", requireAuthWithTenant, pointsController.getPointsStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingPointsRouter,
  auth: "requireAuthWithTenant",
};