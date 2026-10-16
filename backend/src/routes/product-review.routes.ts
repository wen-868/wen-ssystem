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
// ⚠️ S3-237（接线批 10）核查结论：以下 4 行**本批不接**，原因是**无现成审核类码**——
//   `docs/migrations/079_权限矩阵.sql:199-223` 的按钮码全表（goods:create/edit/delete、sale:*、purchase:*、
//   customer:*、finance:*、marketing:create、store:*、system:user|role:*）里**没有**任何审核码；
//   `system-permission-codes.ts` / 迁移 204 的 14 个新码也不含审核语义 ⇒ 按派单卡 §一 组 2「无 ⇒ 只登记并
//   入下一批立码（**不得自行造码**）」处置；页面 `ProductReview.vue`（`router/index.ts:173`）的
//   `meta.roles` 含 STORE_MANAGER ⇒ 后续立码单必须同时解决"码归属店长"（否则挂码即 403）。
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
