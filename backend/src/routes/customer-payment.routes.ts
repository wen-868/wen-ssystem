import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/customer-payment.controller.js";

export const customerPaymentRouter = Router();

customerPaymentRouter.get("/", requireAuthWithTenant, ctrl.list);
customerPaymentRouter.get("/:receiptNo", requireAuthWithTenant, ctrl.getDetail);
customerPaymentRouter.post("/", requireAuthWithTenant, ctrl.create);
customerPaymentRouter.post("/:receiptNo/void", requireAuthWithTenant, ctrl.voidPayment);