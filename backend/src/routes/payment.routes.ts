import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { WechatPay } from "../shared/wechat-pay";
import { requireAuthWithTenant } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requirePermission } from "../middleware/rbac-auth";
import { createPaymentController } from "../controllers/admin/payment.controller";

export const paymentRouter = Router();
const wechatPay = new WechatPay();
const ctrl = createPaymentController(wechatPay);

// ========== 写端点：认证 + CSRF 防护（S3-177） ==========
// 本文件含公开端点（微信支付回调），routeConfig.auth 只能保持 none（auto-routes 不会附加 CSRF），
// 故写端点显式挂载 csrfMiddleware；顺序必须"认证在前"（csrfMiddleware 依赖 req.user）。
// 同款既有合规写法：platform-auth.routes.ts:46。
paymentRouter.post("/orders", requireAuthWithTenant, csrfMiddleware, requirePermission("finance:create"), ctrl.createPaymentOrder);
// 微信支付回调：微信服务器直调，无登录态、无浏览器会话，请求方不会携带 x-csrf-token
// ⇒ 必须保持"无鉴权 + 无 CSRF"，不得挂 csrfMiddleware（挂了会把正常回调打成 403）。
paymentRouter.post("/wx/callback", ctrl.handleWxCallback);
paymentRouter.post("/refunds", requireAuthWithTenant, csrfMiddleware, requirePermission("finance:create"), ctrl.createRefund);
paymentRouter.get("/orders/:payNo", requireAuthWithTenant, ctrl.getPaymentOrder);
paymentRouter.get("/orders", requireAuthWithTenant, ctrl.listPaymentOrders);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/pay",
  router: paymentRouter,
  auth: "none",
};
