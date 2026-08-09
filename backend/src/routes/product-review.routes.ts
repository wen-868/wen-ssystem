import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/product-review.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const productReviewRouter = Router();

// 商品审核
productReviewRouter.post("/", asyncHandler(controller.createProductReview));
productReviewRouter.get("/", asyncHandler(controller.listProductReviews));
productReviewRouter.get("/:id", asyncHandler(controller.getProductReview));
productReviewRouter.post("/:id/approve", asyncHandler(controller.approveProductReview));
productReviewRouter.post("/:id/reject", asyncHandler(controller.rejectProductReview));
productReviewRouter.post("/batch-approve", asyncHandler(controller.batchApproveProductReviews));
productReviewRouter.post("/batch-reject", asyncHandler(controller.batchRejectProductReviews));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/product-reviews",
  router: productReviewRouter,
  auth: "requireAuthWithTenant",
};
