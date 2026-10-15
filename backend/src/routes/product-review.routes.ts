import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/product-review.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const productReviewRouter = Router();

// 商品审核
// S3-220：仅「提交商品审核」（POST /）接线（既有码 goods:create）。全仓无页面调用点：
// 审核页 `ProductReview.vue` 只调 approve / reject / batch-*（那 4 行按派单卡 §二 本批**不接**——
// 该页 `meta.roles` 含 STORE_MANAGER，而生产店长不持任何 goods:* 写码，接了即 403）。
productReviewRouter.post("/", requirePermission("goods:create"), asyncHandler(controller.createProductReview));
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
