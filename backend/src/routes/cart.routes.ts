import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as cartController from "../controllers/admin/cart.controller";

// ========== 购物车路由（小程序端，需认证） ==========

export const miniappCartRouter = Router();

// 购物车 CRUD
miniappCartRouter.get("/cart", cartController.getCartList);
miniappCartRouter.post("/cart/add", cartController.addToCart);
miniappCartRouter.put("/cart/items/:skuId", cartController.updateCartItemQuantity);
miniappCartRouter.delete("/cart/items/:skuId", cartController.deleteCartItem);
miniappCartRouter.post("/cart/clear", cartController.clearCart);
miniappCartRouter.get("/cart/count", cartController.getCartCount);

// 结算
miniappCartRouter.post("/checkout/preview", cartController.checkoutPreview);
miniappCartRouter.post("/checkout/create", cartController.createCheckoutOrder);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/cart",
  router: miniappCartRouter,
  auth: "requireAuthWithTenant",
};
