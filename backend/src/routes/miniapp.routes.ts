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

// ========== 会员模块 ==========
miniappRouter.get("/member/profile", requireAuthWithTenant, ctrl.getMemberProfile);
miniappRouter.get("/member/levels", requireAuthWithTenant, ctrl.getMemberLevels);
miniappRouter.get("/member/points", requireAuthWithTenant, ctrl.getMemberPoints);
miniappRouter.get("/member/growth", requireAuthWithTenant, ctrl.getMemberGrowth);
miniappRouter.get("/member/coupons", requireAuthWithTenant, ctrl.getMemberCoupons);
miniappRouter.post("/member/coupons/:id/receive", requireAuthWithTenant, ctrl.receiveCoupon);

// ========== 用户设置模块 ==========
miniappRouter.put("/user/profile-update", requireAuthWithTenant, ctrl.updateUserProfile);
miniappRouter.post("/user/change-password", requireAuthWithTenant, ctrl.changePassword);

// ========== 批发模块 ==========
miniappRouter.get("/wholesale/products", requireAuthWithTenant, ctrl.getWholesaleProducts);
miniappRouter.get("/wholesale/products/:id", requireAuthWithTenant, ctrl.getWholesaleProductDetail);
miniappRouter.get("/wholesale/categories", requireAuthWithTenant, ctrl.getWholesaleCategories);
miniappRouter.get("/wholesale/cart", requireAuthWithTenant, ctrl.getWholesaleCart);
miniappRouter.post("/wholesale/cart", requireAuthWithTenant, ctrl.addWholesaleCartItem);
miniappRouter.put("/wholesale/cart/:id", requireAuthWithTenant, ctrl.updateWholesaleCartItem);
miniappRouter.delete("/wholesale/cart/:id", requireAuthWithTenant, ctrl.deleteWholesaleCartItem);
miniappRouter.post("/wholesale/orders", requireAuthWithTenant, ctrl.createWholesaleOrder);
miniappRouter.get("/wholesale/orders", requireAuthWithTenant, ctrl.getWholesaleOrders);
miniappRouter.get("/wholesale/orders/:id", requireAuthWithTenant, ctrl.getWholesaleOrderDetail);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp",
  router: miniappRouter,
  auth: "none",
};