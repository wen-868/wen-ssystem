import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/customer-payment.controller";

export const customerPaymentRouter = Router();

customerPaymentRouter.get("/", requireAuthWithTenant, ctrl.list);
customerPaymentRouter.get("/:receiptNo", requireAuthWithTenant, ctrl.getDetail);
customerPaymentRouter.post("/", requireAuthWithTenant, ctrl.create);
customerPaymentRouter.post("/:receiptNo/void", requireAuthWithTenant, ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-payments",
  router: customerPaymentRouter,
  auth: "requireAuthWithTenant",
};
