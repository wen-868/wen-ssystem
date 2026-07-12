import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller";
import { requireStoreAuth } from "../middleware/store-auth";

export const instantRetailStoreRouter = Router();

instantRetailStoreRouter.use(...requireStoreAuth);

instantRetailStoreRouter.get("/orders", orderReceivingController.listOrders);
instantRetailStoreRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
instantRetailStoreRouter.post("/orders/:platformOrderId/confirm", orderReceivingController.confirmOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/cancel", orderReceivingController.cancelOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/start-delivery", fulfillmentController.startDelivery);
instantRetailStoreRouter.post("/orders/:platformOrderId/complete-delivery", fulfillmentController.completeDelivery);

export const routeConfig: RouteConfig = {
  prefix: "/api/store/instant-retail",
  router: instantRetailStoreRouter,
  auth: "none",
};
