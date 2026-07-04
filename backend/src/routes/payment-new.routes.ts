import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as paymentNewController from "../controllers/admin/payment-new.controller.js";

export const paymentNewRouter = Router();
paymentNewRouter.post("/", requireAuthWithTenant, paymentNewController.createPayment);
paymentNewRouter.get("/", requireAuthWithTenant, paymentNewController.listPayments);
paymentNewRouter.get("/:paymentNo", requireAuthWithTenant, paymentNewController.getPaymentDetail);
paymentNewRouter.post("/:paymentNo/writeoff", requireAuthWithTenant, paymentNewController.writeoffPayment);
paymentNewRouter.post("/:paymentNo/void", requireAuthWithTenant, paymentNewController.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/payments-new",
  router: paymentNewRouter,
  auth: "requireAuthWithTenant",
};
