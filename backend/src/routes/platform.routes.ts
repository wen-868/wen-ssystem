import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { getPlatformOverview, listPlatformTenants } from "../controllers/admin/platform.controller";

export const platformRouter = Router();

platformRouter.get("/overview", asyncHandler(getPlatformOverview));
platformRouter.get("/tenants", asyncHandler(listPlatformTenants));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requireAuthWithTenant",
};
