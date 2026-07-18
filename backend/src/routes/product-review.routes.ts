import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/product-review.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const productReviewRouter = Router();

// 商品审核
productReviewRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createProductReview));
productReviewRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listProductReviews));
productReviewRouter.get("/:id", requireAuthWithTenant, asyncHandler(controller.getProductReview));
productReviewRouter.post("/:id/approve", requireAuthWithTenant, asyncHandler(controller.approveProductReview));
productReviewRouter.post("/:id/reject", requireAuthWithTenant, asyncHandler(controller.rejectProductReview));
productReviewRouter.post("/batch-approve", requireAuthWithTenant, asyncHandler(controller.batchApproveProductReviews));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/product-reviews",
  router: productReviewRouter,
  auth: "requireAuthWithTenant",
};
