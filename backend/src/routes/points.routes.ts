import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as pointsController from "../controllers/admin/points.controller.js";

export const pointsRouter = Router();
pointsRouter.get("/rules", requireAuthWithTenant, pointsController.listPointsRules);
pointsRouter.post("/rules", requireAuthWithTenant, pointsController.createPointsRule);
pointsRouter.put("/rules/:id", requireAuthWithTenant, pointsController.updatePointsRule);
pointsRouter.post("/:id/points/adjust", requireAuthWithTenant, pointsController.adjustCustomerPoints);
pointsRouter.get("/:id/points/records", requireAuthWithTenant, pointsController.getCustomerPointsRecords);
pointsRouter.get("/levels/config", requireAuthWithTenant, pointsController.listLevelConfigs);
pointsRouter.post("/levels/config", requireAuthWithTenant, pointsController.createLevelConfig);
pointsRouter.put("/levels/config/:id", requireAuthWithTenant, pointsController.updateLevelConfig);