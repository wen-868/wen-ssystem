import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/customer-payment.controller.js";

export const customerPaymentRouter = Router();

customerPaymentRouter.get("/", requireAuthWithTenant, controller.list);
customerPaymentRouter.get("/:receiptNo", requireAuthWithTenant, controller.getDetail);
customerPaymentRouter.post("/", requireAuthWithTenant, controller.create);
customerPaymentRouter.post("/:receiptNo/void", requireAuthWithTenant, controller.voidPayment);