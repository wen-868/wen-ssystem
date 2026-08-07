import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as subscriptionApplyController from "../controllers/platform/platform-subscription-apply.controller";

export const platformSubscriptionAppliesRouter = Router();

// GET /api/platform/subscription-applies — 订阅申请列表（PENDING 优先）
platformSubscriptionAppliesRouter.get("/", asyncHandler(subscriptionApplyController.listApplies));

// GET /api/platform/subscription-applies/:id — 申请详情
platformSubscriptionAppliesRouter.get("/:id", asyncHandler(subscriptionApplyController.getApply));

// PUT /api/platform/subscription-applies/:id/audit — 审核（通过/驳回）
platformSubscriptionAppliesRouter.put("/:id/audit", asyncHandler(subscriptionApplyController.auditApply));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/subscription-applies",
  router: platformSubscriptionAppliesRouter,
  auth: "requirePlatformAuth",
};
