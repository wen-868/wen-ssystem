import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-billing-arrears.controller";

/**
 * R101-C4-1b 段一（包B）：平台级欠费与增值扣费流路由
 *
 * 前缀 `/api/platform/billing` 与包A（`platform-billing.routes.ts`）及 S2-02 配置路由
 * （`billing-config.routes.ts`）同前缀不同路径段，auto-routes 各自挂载；本文件**不改**包A 文件。
 *
 * 鉴权：`requirePlatformAuth`（平台总后台）。该中间件**不注入 `req.tenantId`**，
 * 控制器不得读该字段（踩坑日志 [35]、S3-86/S3-91）。
 */
export const platformBillingArrearsRouter = Router();

// 静态子路径先于任何 `:param` 通配注册（踩坑日志 [35]：/rank、/stats 被 /:id 吞掉）
platformBillingArrearsRouter.get("/arrears", asyncHandler(controller.listArrearsCtrl));
platformBillingArrearsRouter.post(
  "/arrears/urge",
  asyncHandler(controller.urgeArrearsCtrl)
);
platformBillingArrearsRouter.get(
  "/addon-charges",
  asyncHandler(controller.listAddonChargesCtrl)
);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/billing",
  router: platformBillingArrearsRouter,
  auth: "requirePlatformAuth",
};
