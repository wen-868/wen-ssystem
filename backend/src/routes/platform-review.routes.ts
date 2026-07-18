import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-review.controller";

export const platformReviewRouter = Router();

platformReviewRouter.get("/", asyncHandler(controller.listReviews));
platformReviewRouter.get("/stats", asyncHandler(controller.getReviewStats));
platformReviewRouter.post("/:id/reply", asyncHandler(controller.replyReview));
platformReviewRouter.put("/:id/approval", asyncHandler(controller.reviewApproval));
platformReviewRouter.post("/batch-approval", asyncHandler(controller.batchReviewApproval));
platformReviewRouter.get("/:id", asyncHandler(controller.getReviewById));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/reviews",
  router: platformReviewRouter,
  auth: "requirePlatformAuth",
};
