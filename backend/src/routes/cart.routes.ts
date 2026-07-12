import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as cartController from "../controllers/admin/cart.controller";

// ========== 购物车路由（小程序端，需认证） ==========

export const miniappCartRouter = Router();

// 购物车 CRUD
miniappCartRouter.get("/cart", requireAuthWithTenant, cartController.getCartList);
miniappCartRouter.post("/cart/add", requireAuthWithTenant, cartController.addToCart);
miniappCartRouter.put("/cart/items/:skuId", requireAuthWithTenant, cartController.updateCartItemQuantity);
miniappCartRouter.delete("/cart/items/:skuId", requireAuthWithTenant, cartController.deleteCartItem);
miniappCartRouter.post("/cart/clear", requireAuthWithTenant, cartController.clearCart);
miniappCartRouter.get("/cart/count", requireAuthWithTenant, cartController.getCartCount);

// 结算
miniappCartRouter.post("/checkout/preview", requireAuthWithTenant, cartController.checkoutPreview);
miniappCartRouter.post("/checkout/create", requireAuthWithTenant, cartController.createCheckoutOrder);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/cart",
  router: miniappCartRouter,
  auth: "requireAuthWithTenant",
};
