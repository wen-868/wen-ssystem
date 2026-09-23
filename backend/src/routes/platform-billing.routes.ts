import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-billing.controller";

/**
 * R101-C4-1 包A：平台级财务对账与账单路由
 *
 * 前缀 `/api/platform/billing` 与既有的 `billing-config.routes.ts`（S2-02 欠费策略/增值单价）
 * 同前缀不同路径段，auto-routes 各自挂载；本文件不触碰既有文件。
 *
 * 鉴权：`requirePlatformAuth`（平台总后台）。该中间件**不注入 `req.tenantId`**，
 * 控制器不得读该字段（踩坑日志 [35]、S3-86/S3-91）。
 */
export const platformBillingRouter = Router();

// 静态子路径必须先于任何 `:param` 通配注册（踩坑日志 [35]：/rank、/stats 被 /:id 吞掉）
platformBillingRouter.get(
  "/reconciliation-daily",
  asyncHandler(controller.listDailyReconciliationsCtrl)
);
platformBillingRouter.get(
  "/reconciliation-daily/:date/statement",
  asyncHandler(controller.exportDailyStatementCtrl)
);
platformBillingRouter.get(
  "/reconciliation-daily/:date/diff",
  asyncHandler(controller.getDailyDiffCtrl)
);
platformBillingRouter.post("/generate", asyncHandler(controller.generateBillingCtrl));
platformBillingRouter.post("/statement/export", asyncHandler(controller.exportStatementCtrl));
platformBillingRouter.post("/invoice", asyncHandler(controller.createInvoiceCtrl));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/billing",
  router: platformBillingRouter,
  auth: "requirePlatformAuth",
};
