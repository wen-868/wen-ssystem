import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/custom-report.controller";

export const customReportRouter = Router();

// ========== 模板 ==========
customReportRouter.get("/templates", requireAuthWithTenant, asyncHandler(controller.listTemplates));
customReportRouter.post("/templates", requireAuthWithTenant, asyncHandler(controller.createTemplate));
customReportRouter.put("/templates/:id", requireAuthWithTenant, asyncHandler(controller.updateTemplate));
customReportRouter.delete("/templates/:id", requireAuthWithTenant, asyncHandler(controller.deleteTemplate));
customReportRouter.post("/templates/:id/execute", requireAuthWithTenant, asyncHandler(controller.executeTemplate));

// ========== 定时任务 ==========
customReportRouter.get("/schedules", requireAuthWithTenant, asyncHandler(controller.listSchedules));
customReportRouter.post("/schedules", requireAuthWithTenant, asyncHandler(controller.createSchedule));
customReportRouter.put("/schedules/:id", requireAuthWithTenant, asyncHandler(controller.updateSchedule));
customReportRouter.delete("/schedules/:id", requireAuthWithTenant, asyncHandler(controller.deleteSchedule));
customReportRouter.put("/schedules/:id/toggle", requireAuthWithTenant, asyncHandler(controller.toggleSchedule));
customReportRouter.post("/schedules/:id/run", requireAuthWithTenant, asyncHandler(controller.runSchedule));

export const routeConfig: RouteConfig = {
  prefix: "/api/custom-report",
  router: customReportRouter,
  auth: "requireAuthWithTenant",
};
