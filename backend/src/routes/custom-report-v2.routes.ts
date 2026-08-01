import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/custom-report-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const customReportV2Router = Router();

// 自定义报表CRUD
customReportV2Router.get("/", asyncHandler(controller.listReports));
customReportV2Router.post("/", asyncHandler(controller.createReport));
// id 约束为纯数字：否则 /:id 会拦截 /api/admin/reports/sales-daily 等单段报表路由
// （custom-report-v2 与 report.routes 共用 /api/admin/reports 前缀，R71 脚本测试暴露路由冲突）
customReportV2Router.get("/:id(\\d+)", asyncHandler(controller.getReport));
customReportV2Router.put("/:id(\\d+)", asyncHandler(controller.updateReport));
customReportV2Router.delete("/:id(\\d+)", asyncHandler(controller.deleteReport));

// 报表生成与导出
customReportV2Router.post("/:id(\\d+)/generate", asyncHandler(controller.generateReport));
customReportV2Router.get("/:id(\\d+)/export", asyncHandler(controller.exportReport));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reports",
  router: customReportV2Router,
  auth: "requireAuthWithTenant",
};
