import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-review.controller";

export const platformReviewRouter = Router();

// ========== 审核列表（分�?筛选） ==========
platformReviewRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listReviews));

// ========== 审核统计 ==========
platformReviewRouter.get("/stats", requireAuthWithTenant, asyncHandler(controller.getReviewStats));

// ========== 回复审核 ==========
platformReviewRouter.post("/:id/reply", requireAuthWithTenant, asyncHandler(controller.replyReview));

// ========== 评价审核 ==========
platformReviewRouter.put("/:id/approval", requireAuthWithTenant, asyncHandler(controller.reviewApproval));

// ========== 批量审核 ==========
platformReviewRouter.post("/batch-approval", requireAuthWithTenant, asyncHandler(controller.batchReviewApproval));

// ========== 获取评价详情 ==========
platformReviewRouter.get("/:id", requireAuthWithTenant, asyncHandler(controller.getReviewById));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform-review",
  router: platformReviewRouter,
  auth: "requireAuthWithTenant",
};
