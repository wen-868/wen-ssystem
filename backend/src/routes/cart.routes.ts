import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as cartController from "../controllers/miniapp/cart.controller.js";
import * as checkoutController from "../controllers/miniapp/checkout.controller.js";

export const miniappCartRouter = Router();

miniappCartRouter.get("/cart", requireAuthWithTenant, cartController.getCartList);
miniappCartRouter.post("/cart/add", requireAuthWithTenant, cartController.addToCart);
miniappCartRouter.put("/cart/items/:skuId", requireAuthWithTenant, cartController.updateCartItemQuantity);
miniappCartRouter.delete("/cart/items/:skuId", requireAuthWithTenant, cartController.deleteCartItem);
miniappCartRouter.post("/cart/clear", requireAuthWithTenant, cartController.clearCart);
miniappCartRouter.get("/cart/count", requireAuthWithTenant, cartController.getCartCount);

miniappCartRouter.post("/checkout/preview", requireAuthWithTenant, checkoutController.checkoutPreview);
miniappCartRouter.post("/checkout/create", requireAuthWithTenant, checkoutController.createCheckoutOrder);
