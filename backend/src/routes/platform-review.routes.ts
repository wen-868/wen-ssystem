import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformPermission } from "../middleware/platform-rbac";
import * as controller from "../controllers/admin/platform-review.controller";

export const platformReviewRouter = Router();

// ─── S3-219（收口总清单第 67 项）：本文件 3 个**写**端点挂平台侧写权限码 `review:manage` ───
// 形态与 S3-193 试点域逐字对齐：权限码写在**端点声明的中间件位**（字面量，不抽常量 —— G4 门禁
// `guard-rbac-wiring.mjs` 按调用文本识别）；认证 + CSRF 仍由下方 routeConfig.auth 声明式统一挂载。
// 放行判据：平台超管全通；其余角色需 `t_platform_role_permission` 的 review 域 can_page_btn = 1。
// 读端点（GET）本单不接（第 67 项范围是写端点，同 S3-193 口径）。
platformReviewRouter.get("/", asyncHandler(controller.listReviews));
platformReviewRouter.get("/stats", asyncHandler(controller.getReviewStats));
platformReviewRouter.post(
  "/:id/reply",
  requirePlatformPermission("review:manage"),
  asyncHandler(controller.replyReview)
);
platformReviewRouter.put(
  "/:id/approval",
  requirePlatformPermission("review:manage"),
  asyncHandler(controller.reviewApproval)
);
platformReviewRouter.post(
  "/batch-approval",
  requirePlatformPermission("review:manage"),
  asyncHandler(controller.batchReviewApproval)
);
platformReviewRouter.get("/:id", asyncHandler(controller.getReviewById));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/reviews",
  router: platformReviewRouter,
  auth: "requirePlatformAuth",
};
