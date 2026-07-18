import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import { healthCheck, getSystemInfo, runSystemMigration } from "../controllers/admin/system.controller";

export const systemRouter = Router();

systemRouter.get("/health", asyncHandler(healthCheck));
systemRouter.get("/info", requireAuthWithTenant, asyncHandler(getSystemInfo));
systemRouter.post("/migrate", asyncHandler(runSystemMigration));

export const routeConfig: RouteConfig = {
  prefix: "/api/system",
  router: systemRouter,
  auth: "requireAuthWithTenant",
};
