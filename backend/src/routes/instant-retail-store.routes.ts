import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller.js";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller.js";

import { fail } from '../shared/response.js';
export const instantRetailStoreRouter = Router();

const storeAuth = [requireAuthWithTenant, (req: any, res: any, next: any) => {
  if (!req.user.storeId && !req.user.roles?.includes("SUPER_ADMIN")) {
    res.status(403).json(fail("无门店权限", "403"));
    return;
  }
  next();
}];

instantRetailStoreRouter.use(...storeAuth);

/* ────────────────────────────────────────────────────────────────────────────
 * 门店端端点
 * ──────────────────────────────────────────────────────────────────────────── */

instantRetailStoreRouter.get("/orders", orderReceivingController.listOrders);
instantRetailStoreRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
instantRetailStoreRouter.post("/orders/:platformOrderId/confirm", orderReceivingController.confirmOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/cancel", orderReceivingController.cancelOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/start-delivery", fulfillmentController.startDelivery);
instantRetailStoreRouter.post("/orders/:platformOrderId/complete-delivery", fulfillmentController.completeDelivery);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/instant-retail",
  router: instantRetailStoreRouter,
  auth: "none",
};