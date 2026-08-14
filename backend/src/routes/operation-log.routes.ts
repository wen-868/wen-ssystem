import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import {
  listOperationLogs,
  getOperationLogStatistics,
  getOperationLogDetail,
  getOperationLogTypes,
} from "../controllers/admin/operation-log.controller";

export const operationLogRouter = Router();

operationLogRouter.get("/", asyncHandler(listOperationLogs));
operationLogRouter.get("/statistics", asyncHandler(getOperationLogStatistics));
operationLogRouter.get("/types", asyncHandler(getOperationLogTypes));
operationLogRouter.get("/:id", asyncHandler(getOperationLogDetail));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/operation-logs",
  router: operationLogRouter,
  auth: "requireAuthWithTenant",
};
