import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/tenant-usage.controller";

export const adminTenantUsageRouter = Router();

adminTenantUsageRouter.get("/stats", asyncHandler(controller.getStats));
adminTenantUsageRouter.get("/trend", asyncHandler(controller.getTrend));
adminTenantUsageRouter.get("/module-usage", asyncHandler(controller.getModuleUsage));
adminTenantUsageRouter.get("/ranking", asyncHandler(controller.getRanking));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/tenant-usage",
  router: adminTenantUsageRouter,
  auth: "requireAuth",
};
