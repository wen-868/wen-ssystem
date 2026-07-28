import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as paymentNewController from "../controllers/admin/payment-new.controller";

export const paymentNewRouter = Router();
paymentNewRouter.post("/", paymentNewController.createPayment);
paymentNewRouter.get("/", paymentNewController.listPayments);
paymentNewRouter.get("/:paymentNo", paymentNewController.getPaymentDetail);
paymentNewRouter.post("/:paymentNo/writeoff", paymentNewController.writeoffPayment);
paymentNewRouter.post("/:paymentNo/void", paymentNewController.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/payments-new",
  router: paymentNewRouter,
  auth: "requireAuthWithTenant",
};
