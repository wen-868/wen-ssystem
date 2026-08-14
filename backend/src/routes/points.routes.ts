import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as pointsController from "../controllers/admin/points.controller";

export const pointsRouter = Router();
pointsRouter.get("/rules", pointsController.listPointsRules);
pointsRouter.post("/rules", pointsController.createPointsRule);
pointsRouter.put("/rules/:id", pointsController.updatePointsRule);
pointsRouter.post("/:id/points/adjust", pointsController.adjustCustomerPoints);
pointsRouter.get("/:id/points/records", pointsController.getCustomerPointsRecords);
pointsRouter.get("/levels/config", pointsController.listLevelConfigs);
pointsRouter.post("/levels/config", pointsController.createLevelConfig);
pointsRouter.put("/levels/config/:id", pointsController.updateLevelConfig);
pointsRouter.put("/levels/config/:id/status", pointsController.updateLevelConfigStatus);
pointsRouter.delete("/levels/config/:id", pointsController.deleteLevelConfig);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members",
  router: pointsRouter,
  auth: "requireAuthWithTenant",
};
