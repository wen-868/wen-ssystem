import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-audit-log.controller";

export const adminPlatformAuditLogRouter = Router();

adminPlatformAuditLogRouter.get("/", asyncHandler(controller.listAuditLogs));
adminPlatformAuditLogRouter.get("/:id", asyncHandler(controller.getAuditLogById));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/platform-audit-logs",
  router: adminPlatformAuditLogRouter,
  auth: "requireAuth",
};
