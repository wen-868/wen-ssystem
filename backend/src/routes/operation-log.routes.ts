import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { listOperationLogs, getOperationLogStatistics } from "../controllers/operation-log.controller";

export const operationLogRouter = Router();

operationLogRouter.get("/", requireAuthWithTenant, asyncHandler(listOperationLogs));
operationLogRouter.get("/statistics", requireAuthWithTenant, asyncHandler(getOperationLogStatistics));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/operation-logs",
  router: operationLogRouter,
  auth: "requireAuthWithTenant",
};
