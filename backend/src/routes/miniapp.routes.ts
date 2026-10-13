import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { priceResponseFilter } from "../middleware/price-guard";
import * as ctrl from "../controllers/miniapp/miniapp.controller";

export const miniappRouter = Router();
miniappRouter.use(priceResponseFilter());

// ========== 写端点 CSRF 防护（S3-177） ==========
// 本文件混有公开端点（POST /login、微信支付回调 POST /pay/notify），routeConfig.auth 只能保持 none，
// 无法走声明式（auto-routes 不会附加 CSRF）；故所有**已认证**的写端点显式挂载 csrfMiddleware，
// 顺序必须"认证在前"（csrfMiddleware 依赖 req.user）。同款既有合规写法：platform-auth.routes.ts:46。
// S3-196（总清单第 52 项）：认证中间件一律改 requireConsumerAuthWithTenant —— 消费者端既接受
// 商家端 JWT（原行为，含既有测试），也接受微信令牌（按 openid 解析绑定的会员身份；roles 恒空）。

// ========== 登录 ==========
miniappRouter.post("/login", ctrl.getProfile); // 简化登录，直接返回用户信息

// ========== 商品模块 ==========
miniappRouter.get("/products", requireConsumerAuthWithTenant, ctrl.getProducts);
miniappRouter.get("/products/:id", requireConsumerAuthWithTenant, ctrl.getProductDetail);
miniappRouter.get("/categories", requireConsumerAuthWithTenant, ctrl.getCategories);

// ========== 购物车模块 ==========
// GET /api/miniapp/cart：S3-179 删除死代码。
// cart.routes.ts（prefix "/api/miniapp/cart"，get("/")）按文件名排序先注册
// （"cart…" < "miniapp…"）⇒ 这一行永不执行；本文件其余 /cart 写端点（POST/PUT/DELETE）无冲突，保持原样。
miniappRouter.post("/cart", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.addToCart);
miniappRouter.put("/cart/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.updateCartItem);
miniappRouter.delete("/cart/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.deleteCartItem);
miniappRouter.delete("/cart", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.clearCart);

// ========== 订单模块 ==========
miniappRouter.post("/orders", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.createOrder);
miniappRouter.get("/orders", requireConsumerAuthWithTenant, ctrl.getOrders);
miniappRouter.get("/orders/:id", requireConsumerAuthWithTenant, ctrl.getOrderDetail);
miniappRouter.post("/orders/:id/pay", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.payOrder);
miniappRouter.post("/orders/:id/cancel", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.cancelOrder);
miniappRouter.post("/orders/:id/confirm-receive", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.confirmReceipt);
miniappRouter.get("/orders/:id/pay-result", requireConsumerAuthWithTenant, ctrl.queryPayResult);
miniappRouter.get("/orders/:id/logistics", requireConsumerAuthWithTenant, ctrl.getOrderLogistics);
miniappRouter.put("/orders/:id/delete", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.deleteMiniappOrder);

// 微信支付回调（无登录态，微信服务器直调）：请求方不会携带 x-csrf-token，
// 必须保持"无鉴权 + 无 CSRF"（不得挂 csrfMiddleware，否则正常回调被打成 403）
miniappRouter.post("/pay/notify", ctrl.payNotify);

// ========== 储值卡 ==========
miniappRouter.get("/stored-card", requireConsumerAuthWithTenant, ctrl.getStoredCardInfo);
miniappRouter.get("/stored-card/records", requireConsumerAuthWithTenant, ctrl.getStoredCardRecords);
miniappRouter.get("/stored-card/recharge-options", requireConsumerAuthWithTenant, ctrl.getStoredRechargeOptions);
miniappRouter.post("/stored-card/recharge", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.rechargeStoredCard);

// ========== 用户模块 ==========
miniappRouter.get("/user/profile", requireConsumerAuthWithTenant, ctrl.getProfile);
miniappRouter.put("/user/profile", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.updateProfile);
miniappRouter.get("/user/addresses", requireConsumerAuthWithTenant, ctrl.getAddresses);
miniappRouter.post("/user/addresses", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.createAddress);
miniappRouter.put("/user/addresses/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.updateAddress);
miniappRouter.delete("/user/addresses/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.deleteAddress);
miniappRouter.post("/user/addresses/:id/default", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.setDefaultAddress);

// ========== 营销模块 ==========
miniappRouter.get("/promotions", requireConsumerAuthWithTenant, ctrl.getPromotions);
miniappRouter.get("/coupons", requireConsumerAuthWithTenant, ctrl.getCoupons);
miniappRouter.post("/coupons/:id/use", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.useCoupon);

// ========== 会员模块 ==========
miniappRouter.get("/member/profile", requireConsumerAuthWithTenant, ctrl.getMemberProfile);
miniappRouter.get("/member/levels", requireConsumerAuthWithTenant, ctrl.getMemberLevels);
miniappRouter.get("/member/points", requireConsumerAuthWithTenant, ctrl.getMemberPoints);
miniappRouter.get("/member/growth", requireConsumerAuthWithTenant, ctrl.getMemberGrowth);
miniappRouter.get("/member/coupons", requireConsumerAuthWithTenant, ctrl.getMemberCoupons);
miniappRouter.post("/member/coupons/:id/receive", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.receiveCoupon);

// ========== 用户设置模块 ==========
miniappRouter.put("/user/profile-update", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.updateUserProfile);
miniappRouter.post("/user/change-password", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.changePassword);

// ========== 批发模块 ==========
miniappRouter.get("/wholesale/products", requireConsumerAuthWithTenant, ctrl.getWholesaleProducts);
miniappRouter.get("/wholesale/products/:id", requireConsumerAuthWithTenant, ctrl.getWholesaleProductDetail);
miniappRouter.get("/wholesale/categories", requireConsumerAuthWithTenant, ctrl.getWholesaleCategories);
miniappRouter.get("/wholesale/cart", requireConsumerAuthWithTenant, ctrl.getWholesaleCart);
miniappRouter.post("/wholesale/cart", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.addWholesaleCartItem);
miniappRouter.put("/wholesale/cart/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.updateWholesaleCartItem);
miniappRouter.delete("/wholesale/cart/:id", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.deleteWholesaleCartItem);
miniappRouter.post("/wholesale/orders", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.createWholesaleOrder);
miniappRouter.get("/wholesale/orders", requireConsumerAuthWithTenant, ctrl.getWholesaleOrders);
miniappRouter.get("/wholesale/orders/:id", requireConsumerAuthWithTenant, ctrl.getWholesaleOrderDetail);
miniappRouter.get("/wholesale/calculate-price", requireConsumerAuthWithTenant, ctrl.calculateWholesaleTierPrice);
miniappRouter.post("/wholesale/cart/delete", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.deleteWholesaleCartItems);
miniappRouter.put("/wholesale/cart/:itemId/select", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.toggleWholesaleCartSelect);
miniappRouter.put("/wholesale/cart/select-all", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.toggleWholesaleCartSelectAll);
miniappRouter.post("/wholesale/orders/:orderId/cancel", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.cancelWholesaleOrder);
miniappRouter.post("/wholesale/orders/:orderId/confirm-receive", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.confirmWholesaleReceive);
miniappRouter.get("/wholesale/orders/confirm/preview", requireConsumerAuthWithTenant, ctrl.wholesaleOrderConfirmPreview);
miniappRouter.post("/wholesale/orders/buy-now", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.buyWholesaleNow);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp",
  router: miniappRouter,
  auth: "none",
};
