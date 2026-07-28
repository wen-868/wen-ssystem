import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as limitedDiscountController from "../controllers/admin/marketing-limited-discount.controller";

export const marketingLimitedDiscountRouter = Router();

// ==================== 限时折扣 (Admin) ====================
marketingLimitedDiscountRouter.post("/", limitedDiscountController.createLimitedDiscount);
marketingLimitedDiscountRouter.get("/", limitedDiscountController.listLimitedDiscounts);
marketingLimitedDiscountRouter.get("/:id", limitedDiscountController.getLimitedDiscountDetail);
marketingLimitedDiscountRouter.put("/:id", limitedDiscountController.updateLimitedDiscount);
marketingLimitedDiscountRouter.delete("/:id", limitedDiscountController.deleteLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/activate", limitedDiscountController.activateLimitedDiscount);
marketingLimitedDiscountRouter.post("/:id/pause", limitedDiscountController.pauseLimitedDiscount);
marketingLimitedDiscountRouter.get("/:id/products", limitedDiscountController.getDiscountProducts);
marketingLimitedDiscountRouter.post("/:id/products", limitedDiscountController.addDiscountProduct);
marketingLimitedDiscountRouter.delete("/:id/products/:productId", limitedDiscountController.removeDiscountProduct);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/limited-discounts",
  router: marketingLimitedDiscountRouter,
  auth: "requireAuthWithTenant",
};
