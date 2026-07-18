import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-reconciliation.controller";

export const platformReconciliationRouter = Router();

platformReconciliationRouter.get("/", asyncHandler(controller.listReconciliations));
platformReconciliationRouter.post("/", asyncHandler(controller.createReconciliation));
platformReconciliationRouter.put("/:id", asyncHandler(controller.updateReconciliation));
platformReconciliationRouter.get("/:id", asyncHandler(controller.getReconciliationDetail));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/reconciliation",
  router: platformReconciliationRouter,
  auth: "requirePlatformAuth",
};
