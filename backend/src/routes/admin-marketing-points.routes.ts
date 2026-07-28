import { Router } from "express";

import * as pointsController from "../controllers/admin/marketing-points.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingPointsRouter = Router();

// 积分管理
adminMarketingPointsRouter.get("/points/rule", pointsController.getPointsRule);
adminMarketingPointsRouter.put("/points/rule", pointsController.updatePointsRule);
adminMarketingPointsRouter.get("/points/records", pointsController.listPointsRecords);
adminMarketingPointsRouter.get("/points/user/:userId", pointsController.getUserPoints);
adminMarketingPointsRouter.get("/points/my-records", pointsController.listMyPointsRecords);
adminMarketingPointsRouter.get("/points/detail", pointsController.getPointsRecords);
adminMarketingPointsRouter.post("/points/redeem", pointsController.createPointsRedeem);
adminMarketingPointsRouter.get("/points/stats", pointsController.getPointsStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingPointsRouter,
  auth: "requireAuthWithTenant",
};