import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/purchase-payment.controller.js";

export const purchasePaymentRouter = Router();
purchasePaymentRouter.get("/", requireAuthWithTenant, ctrl.list);
purchasePaymentRouter.get("/:paymentNo", requireAuthWithTenant, ctrl.getDetail);
purchasePaymentRouter.post("/", requireAuthWithTenant, ctrl.create);
purchasePaymentRouter.post("/:paymentNo/approve", requireAuthWithTenant, ctrl.approve);
purchasePaymentRouter.post("/:paymentNo/void", requireAuthWithTenant, ctrl.voidPayment);