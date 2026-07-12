import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/purchase-payment.controller";

export const purchasePaymentRouter = Router();
purchasePaymentRouter.get("/", requireAuthWithTenant, ctrl.list);
purchasePaymentRouter.get("/:paymentNo", requireAuthWithTenant, ctrl.getDetail);
purchasePaymentRouter.post("/", requireAuthWithTenant, ctrl.create);
purchasePaymentRouter.post("/:paymentNo/approve", requireAuthWithTenant, ctrl.approve);
purchasePaymentRouter.post("/:paymentNo/void", requireAuthWithTenant, ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-payments",
  router: purchasePaymentRouter,
  auth: "requireAuthWithTenant",
};
