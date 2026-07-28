import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderController from "../controllers/store/order.controller";
import * as otherController from "../controllers/store/other.controller";

export const storeOrderRouter = Router();

// 订单
storeOrderRouter.get("/orders", orderController.listOrders);
storeOrderRouter.get("/orders/:orderNo", orderController.getOrderDetail);
storeOrderRouter.post("/orders/:orderNo/accept", orderController.acceptOrder);
storeOrderRouter.post("/orders/:orderNo/start-delivery", orderController.startDelivery);
storeOrderRouter.post("/orders/:orderNo/complete-delivery", orderController.completeDelivery);
storeOrderRouter.post("/orders/:orderNo/reject", orderController.rejectOrder);
storeOrderRouter.post("/orders/:orderNo/cancel", orderController.cancelOrder);

// 挂单
storeOrderRouter.post("/hold-orders", otherController.createHoldOrder);
storeOrderRouter.get("/hold-orders", otherController.listHoldOrders);
storeOrderRouter.post("/hold-orders/:holdNo/restore", otherController.restoreHoldOrder);
storeOrderRouter.delete("/hold-orders/:holdNo", otherController.deleteHoldOrder);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeOrderRouter,
  auth: "requireAuthWithTenant",
};