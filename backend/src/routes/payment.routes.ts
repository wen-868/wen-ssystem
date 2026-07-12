import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { WechatPay } from "../shared/wechat-pay";
import { requireAuthWithTenant } from "../middleware/auth";
import { createPaymentController } from "../controllers/payment.controller";

export const paymentRouter = Router();
const wechatPay = new WechatPay();
const ctrl = createPaymentController(wechatPay);

paymentRouter.post("/orders", requireAuthWithTenant, ctrl.createPaymentOrder);
paymentRouter.post("/wx/callback", ctrl.handleWxCallback);
paymentRouter.post("/refunds", requireAuthWithTenant, ctrl.createRefund);
paymentRouter.get("/orders/:payNo", requireAuthWithTenant, ctrl.getPaymentOrder);
paymentRouter.get("/orders", requireAuthWithTenant, ctrl.listPaymentOrders);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/pay",
  router: paymentRouter,
  auth: "none",
};
