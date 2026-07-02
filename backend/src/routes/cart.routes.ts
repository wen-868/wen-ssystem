import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as cartController from "../controllers/admin/cart.controller.js";

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

// 零售购物车
miniappCartRouter.post("/retail-cart/add", requireAuthWithTenant, cartController.addToRetailCart);
miniappCartRouter.delete("/retail-cart/:skuId", requireAuthWithTenant, cartController.removeFromRetailCart);
miniappCartRouter.put("/retail-cart/:skuId", requireAuthWithTenant, cartController.updateRetailCartItem);
miniappCartRouter.get("/retail-cart", requireAuthWithTenant, cartController.getRetailCart);