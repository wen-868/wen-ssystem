import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as cartController from "../controllers/admin/cart.controller";

// ========== 购物车路由（小程序端，需认证） ==========
// S3-196（总清单第 52 项）：消费者端改用 requireConsumerAuthWithTenant ——
// 既接受商家端 JWT（原行为），也接受微信令牌（按 openid 解析绑定的会员身份），
// 并使 auto-routes 照常成对附加 csrfMiddleware。
export const miniappCartRouter = Router();

// 购物车 CRUD
miniappCartRouter.get("/", cartController.getCartList);
miniappCartRouter.post("/add", cartController.addToCart);
miniappCartRouter.put("/items/:skuId", cartController.updateCartItemQuantity);
miniappCartRouter.delete("/items/:skuId", cartController.deleteCartItem);
miniappCartRouter.post("/clear", cartController.clearCart);
miniappCartRouter.get("/count", cartController.getCartCount);

// 结算
miniappCartRouter.post("/checkout/preview", cartController.checkoutPreview);
miniappCartRouter.post("/checkout/create", cartController.createCheckoutOrder);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/cart",
  router: miniappCartRouter,
  auth: "requireConsumerAuthWithTenant",
};
