import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as otherController from "../controllers/store/other.controller.js";
import * as receivableController from "../controllers/store/receivable.controller.js";

export const storeReceivableRouter = Router();

storeReceivableRouter.use(requireAuthWithTenant);

// 收款链接 / 支付 / 退款
storeReceivableRouter.get("/collection-links", otherController.listCollectionLinks);
storeReceivableRouter.get("/payment-orders", otherController.listPaymentOrders);
storeReceivableRouter.get("/refund-orders", otherController.listRefundOrders);

// 应收
storeReceivableRouter.get("/receivables", receivableController.listReceivables);
storeReceivableRouter.post("/receivables/:receivableNo/payment", receivableController.paymentOnReceivable);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeReceivableRouter,
  auth: "none",
};