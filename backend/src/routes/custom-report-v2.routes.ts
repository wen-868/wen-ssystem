import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/custom-report-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const customReportV2Router = Router();

// 自定义报表CRUD
customReportV2Router.get("/", requireAuthWithTenant, asyncHandler(controller.listReports));
customReportV2Router.post("/", requireAuthWithTenant, asyncHandler(controller.createReport));
customReportV2Router.get("/:id", requireAuthWithTenant, asyncHandler(controller.getReport));
customReportV2Router.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateReport));
customReportV2Router.delete("/:id", requireAuthWithTenant, asyncHandler(controller.deleteReport));

// 报表生成与导出
customReportV2Router.post("/:id/generate", requireAuthWithTenant, asyncHandler(controller.generateReport));
customReportV2Router.get("/:id/export", requireAuthWithTenant, asyncHandler(controller.exportReport));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reports",
  router: customReportV2Router,
  auth: "requireAuthWithTenant",
};
