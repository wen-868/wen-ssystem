import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/purchase-payment.controller.js";

export const purchasePaymentRouter = Router();

purchasePaymentRouter.get("/", requireAuthWithTenant, controller.list);
purchasePaymentRouter.get("/:paymentNo", requireAuthWithTenant, controller.getDetail);
purchasePaymentRouter.post("/", requireAuthWithTenant, controller.create);
purchasePaymentRouter.post("/:paymentNo/approve", requireAuthWithTenant, controller.approve);
purchasePaymentRouter.post("/:paymentNo/void", requireAuthWithTenant, controller.voidPayment);