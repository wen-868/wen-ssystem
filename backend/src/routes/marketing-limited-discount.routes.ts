import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as limitedDiscountController from "../controllers/admin/marketing-limited-discount.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const marketingLimitedDiscountRouter = Router();

// ==================== 限时折扣 (Admin) ====================
// S3-226（第 43 项 B2 批 8 · 营销域接线）：限时折扣 7 条写端点挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `marketing/MarketingLimitedDiscount.vue:485/482/327/329/488`
//（页面 `router/index.ts:222` 角色 = SUPER_ADMIN）；`DELETE /:id` 与 `DELETE /:id/products/:productId`
// 全仓无页面调用点；生产持有 `marketing:create` ⊇ {SUPER_ADMIN} ⇒ 零回归（app-mobile / miniapp 零命中）。
marketingLimitedDiscountRouter.post("/", requirePermission("marketing:create"), limitedDiscountController.createLimitedDiscount);
marketingLimitedDiscountRouter.get("/", limitedDiscountController.listLimitedDiscounts);
marketingLimitedDiscountRouter.get("/:id", limitedDiscountController.getLimitedDiscountDetail);
marketingLimitedDiscountRouter.put("/:id", requirePermission("marketing:create"), limitedDiscountController.updateLimitedDiscount);
marketingLimitedDiscountRouter.delete("/:id", requirePermission("marketing:create"), limitedDiscountController.deleteLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/activate", requirePermission("marketing:create"), limitedDiscountController.activateLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/pause", requirePermission("marketing:create"), limitedDiscountController.pauseLimitedDiscount);
marketingLimitedDiscountRouter.get("/:id/products", limitedDiscountController.getDiscountProducts);
marketingLimitedDiscountRouter.post("/:id/products", requirePermission("marketing:create"), limitedDiscountController.addDiscountProduct);
marketingLimitedDiscountRouter.delete("/:id/products/:productId", requirePermission("marketing:create"), limitedDiscountController.removeDiscountProduct);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/limited-discounts",
  router: marketingLimitedDiscountRouter,
  auth: "requireAuthWithTenant",
};
