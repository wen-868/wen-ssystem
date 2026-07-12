import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-review.controller";

export const platformReviewRouter = Router();

// ========== 审核列表（分页+筛选） ==========
platformReviewRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listReviews));

// ========== 审核统计 ==========
platformReviewRouter.get("/stats", requireAuthWithTenant, asyncHandler(controller.getReviewStats));

// ========== 回复审核 ==========
platformReviewRouter.post("/:id/reply", requireAuthWithTenant, asyncHandler(controller.replyReview));
