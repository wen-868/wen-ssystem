import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-settlement.controller";

export const adminPlatformSettlementRouter = Router();

adminPlatformSettlementRouter.get("/stats", asyncHandler(controller.getSettlementStats));
adminPlatformSettlementRouter.get("/", asyncHandler(controller.listSettlements));
adminPlatformSettlementRouter.get("/:id", asyncHandler(controller.getSettlementById));
adminPlatformSettlementRouter.post("/", asyncHandler(controller.createSettlement));
adminPlatformSettlementRouter.put("/:id", asyncHandler(controller.updateSettlementStatus));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/settlements",
  router: adminPlatformSettlementRouter,
  auth: "requirePlatformAuth",
};
