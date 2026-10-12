import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller";
import { requireStoreAuth } from "../middleware/store-auth";
import { csrfMiddleware } from "../middleware/csrf";

export const instantRetailStoreRouter = Router();

instantRetailStoreRouter.use(...requireStoreAuth);

instantRetailStoreRouter.get("/orders", orderReceivingController.listOrders);
instantRetailStoreRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
// ========== 写端点 CSRF 防护（S3-178 #2） ==========
// L9 的 requireStoreAuth = [...requireAuthWithTenant, 门店校验]（middleware/store-auth.ts:5-14），
// 认证已在前；csrfMiddleware 依赖 req.user，故只能挂在其后（顺序不得颠倒）。S3-177 同款写法。
instantRetailStoreRouter.post("/orders/:platformOrderId/confirm", csrfMiddleware, orderReceivingController.confirmOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/cancel", csrfMiddleware, orderReceivingController.cancelOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/start-delivery", csrfMiddleware, fulfillmentController.startDelivery);
instantRetailStoreRouter.post("/orders/:platformOrderId/complete-delivery", csrfMiddleware, fulfillmentController.completeDelivery);

export const routeConfig: RouteConfig = {
  prefix: "/api/store/instant-retail",
  router: instantRetailStoreRouter,
  auth: "none",
};
