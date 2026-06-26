import { Router } from "express";
import { WechatPay } from "../shared/wechat-pay.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { createPaymentController } from "../controllers/payment.controller.js";

export const paymentRouter = Router();
const wechatPay = new WechatPay();
const ctrl = createPaymentController(wechatPay);

paymentRouter.post("/orders", requireAuthWithTenant, ctrl.createPaymentOrder);
paymentRouter.post("/wx/callback", ctrl.handleWxCallback);
paymentRouter.post("/refunds", requireAuthWithTenant, ctrl.createRefund);
paymentRouter.get("/orders/:payNo", requireAuthWithTenant, ctrl.getPaymentOrder);
paymentRouter.get("/orders", requireAuthWithTenant, ctrl.listPaymentOrders);