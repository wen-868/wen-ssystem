import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { priceResponseFilter } from "../middleware/price-guard";
import * as ctrl from "../controllers/miniapp/miniapp.controller";

export const miniappRouter = Router();
miniappRouter.use(priceResponseFilter());

// ========== 登录 ==========
miniappRouter.post("/login", ctrl.getProfile); // 简化登录，直接返回用户信息

// ========== 商品模块 ==========
miniappRouter.get("/products", requireAuthWithTenant, ctrl.getProducts);
miniappRouter.get("/products/:id", requireAuthWithTenant, ctrl.getProductDetail);
miniappRouter.get("/categories", requireAuthWithTenant, ctrl.getCategories);

// ========== 购物车模块 ==========
miniappRouter.get("/cart", requireAuthWithTenant, ctrl.getCart);
miniappRouter.post("/cart", requireAuthWithTenant, ctrl.addToCart);
miniappRouter.put("/cart/:id", requireAuthWithTenant, ctrl.updateCartItem);
miniappRouter.delete("/cart/:id", requireAuthWithTenant, ctrl.deleteCartItem);
miniappRouter.delete("/cart", requireAuthWithTenant, ctrl.clearCart);

// ========== 订单模块 ==========
miniappRouter.post("/orders", requireAuthWithTenant, ctrl.createOrder);
miniappRouter.get("/orders", requireAuthWithTenant, ctrl.getOrders);
miniappRouter.get("/orders/:id", requireAuthWithTenant, ctrl.getOrderDetail);
miniappRouter.post("/orders/:id/pay", requireAuthWithTenant, ctrl.payOrder);

// ========== 用户模块 ==========
miniappRouter.get("/user/profile", requireAuthWithTenant, ctrl.getProfile);
miniappRouter.put("/user/profile", requireAuthWithTenant, ctrl.updateProfile);
miniappRouter.get("/user/addresses", requireAuthWithTenant, ctrl.getAddresses);
miniappRouter.post("/user/addresses", requireAuthWithTenant, ctrl.createAddress);
miniappRouter.put("/user/addresses/:id", requireAuthWithTenant, ctrl.updateAddress);
miniappRouter.delete("/user/addresses/:id", requireAuthWithTenant, ctrl.deleteAddress);
miniappRouter.post("/user/addresses/:id/default", requireAuthWithTenant, ctrl.setDefaultAddress);

// ========== 营销模块 ==========
miniappRouter.get("/promotions", requireAuthWithTenant, ctrl.getPromotions);
miniappRouter.get("/coupons", requireAuthWithTenant, ctrl.getCoupons);
miniappRouter.post("/coupons/:id/use", requireAuthWithTenant, ctrl.useCoupon);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp",
  router: miniappRouter,
  auth: "none",
};