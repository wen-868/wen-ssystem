import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/customer-payment.controller";

export const customerPaymentRouter = Router();

customerPaymentRouter.get("/", ctrl.list);
customerPaymentRouter.get("/:receiptNo", ctrl.getDetail);
customerPaymentRouter.post("/", ctrl.create);
customerPaymentRouter.post("/:receiptNo/void", ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-payments",
  router: customerPaymentRouter,
  auth: "requireAuthWithTenant",
};
