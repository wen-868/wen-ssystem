import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/marketing-asset.controller";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", asyncHandler(controller.getMarketingAssets));
// S3-226（第 43 项 B2 批 8 · 营销域接线）：营销资产增/改/删 3 条挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `api/marketing.ts:317/318/319` 打的是 `/admin/marketing-assets*`（**后端前缀是 `/api/marketing-asset`**，
// 路径错配 ⇒ 调用即 404）⇒ 全仓**无有效调用点**；使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归。
marketingAssetRouter.post("/", requirePermission("marketing:create"), asyncHandler(controller.createMarketingAsset));
marketingAssetRouter.put("/:id", requirePermission("marketing:create"), asyncHandler(controller.updateMarketingAsset));
marketingAssetRouter.delete("/:id", requirePermission("marketing:create"), asyncHandler(controller.deleteMarketingAsset));

export const routeConfig: RouteConfig = {
  prefix: "/api/marketing-asset",
  router: marketingAssetRouter,
  auth: "requireAuthWithTenant",
};
