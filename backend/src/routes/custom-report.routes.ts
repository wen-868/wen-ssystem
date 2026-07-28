import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/custom-report.controller";

export const customReportRouter = Router();

// ========== 模板 ==========
customReportRouter.get("/templates", asyncHandler(controller.listTemplates));
customReportRouter.post("/templates", asyncHandler(controller.createTemplate));
customReportRouter.put("/templates/:id", asyncHandler(controller.updateTemplate));
customReportRouter.delete("/templates/:id", asyncHandler(controller.deleteTemplate));
customReportRouter.post("/templates/:id/execute", asyncHandler(controller.executeTemplate));

// ========== 定时任务 ==========
customReportRouter.get("/schedules", asyncHandler(controller.listSchedules));
customReportRouter.post("/schedules", asyncHandler(controller.createSchedule));
customReportRouter.put("/schedules/:id", asyncHandler(controller.updateSchedule));
customReportRouter.delete("/schedules/:id", asyncHandler(controller.deleteSchedule));
customReportRouter.put("/schedules/:id/toggle", asyncHandler(controller.toggleSchedule));
customReportRouter.post("/schedules/:id/run", asyncHandler(controller.runSchedule));

export const routeConfig: RouteConfig = {
  prefix: "/api/custom-report",
  router: customReportRouter,
  auth: "requireAuthWithTenant",
};
