import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/purchase-payment.controller";

export const purchasePaymentRouter = Router();
purchasePaymentRouter.get("/", ctrl.list);
purchasePaymentRouter.get("/:paymentNo", ctrl.getDetail);
purchasePaymentRouter.post("/", ctrl.create);
purchasePaymentRouter.post("/:paymentNo/approve", ctrl.approve);
purchasePaymentRouter.post("/:paymentNo/void", ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-payments",
  router: purchasePaymentRouter,
  auth: "requireAuthWithTenant",
};
