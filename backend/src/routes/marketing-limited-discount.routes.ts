import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as limitedDiscountController from "../controllers/admin/marketing-limited-discount.controller.js";

export const marketingLimitedDiscountRouter = Router();

// ==================== 限时折扣 (Admin) ====================
marketingLimitedDiscountRouter.post("/", requireAuthWithTenant, limitedDiscountController.createLimitedDiscount);
marketingLimitedDiscountRouter.get("/", requireAuthWithTenant, limitedDiscountController.listLimitedDiscounts);
marketingLimitedDiscountRouter.get("/:id", requireAuthWithTenant, limitedDiscountController.getLimitedDiscountDetail);
marketingLimitedDiscountRouter.put("/:id", requireAuthWithTenant, limitedDiscountController.updateLimitedDiscount);
marketingLimitedDiscountRouter.delete("/:id", requireAuthWithTenant, limitedDiscountController.deleteLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/activate", requireAuthWithTenant, limitedDiscountController.activateLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/pause", requireAuthWithTenant, limitedDiscountController.pauseLimitedDiscount);
marketingLimitedDiscountRouter.get("/:id/products", requireAuthWithTenant, limitedDiscountController.getDiscountProducts);
marketingLimitedDiscountRouter.post("/:id/products", requireAuthWithTenant, limitedDiscountController.addDiscountProduct);
marketingLimitedDiscountRouter.delete("/:id/products/:productId", requireAuthWithTenant, limitedDiscountController.removeDiscountProduct);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/limited-discounts",
  router: marketingLimitedDiscountRouter,
  auth: "requireAuthWithTenant",
};
