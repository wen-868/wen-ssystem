import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as positionController from "../controllers/admin/position.controller";

export const positionRouter = Router();
positionRouter.get("/", requireAuthWithTenant, positionController.listPositions);
positionRouter.get("/all", requireAuthWithTenant, positionController.listAllPositions);
positionRouter.get("/:id", requireAuthWithTenant, positionController.getPosition);
positionRouter.post("/", requireAuthWithTenant, positionController.createPosition);
positionRouter.put("/:id", requireAuthWithTenant, positionController.updatePosition);
positionRouter.delete("/:id", requireAuthWithTenant, positionController.deletePosition);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/positions",
  router: positionRouter,
  auth: "requireAuthWithTenant",
};
