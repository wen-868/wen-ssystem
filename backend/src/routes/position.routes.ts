import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as positionController from "../controllers/admin/position.controller";

export const positionRouter = Router();
positionRouter.get("/", positionController.listPositions);
positionRouter.get("/all", positionController.listAllPositions);
positionRouter.get("/:id", positionController.getPosition);
positionRouter.post("/", positionController.createPosition);
positionRouter.put("/:id", positionController.updatePosition);
positionRouter.delete("/:id", positionController.deletePosition);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/positions",
  router: positionRouter,
  auth: "requireAuthWithTenant",
};
