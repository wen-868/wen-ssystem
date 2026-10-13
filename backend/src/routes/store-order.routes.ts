import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderController from "../controllers/store/order.controller";
import * as otherController from "../controllers/store/other.controller";

export const storeOrderRouter = Router();
export const storeHoldOrderRouter = Router();

// 订单
storeOrderRouter.get("/", orderController.listOrders);
storeOrderRouter.get("/:orderNo", orderController.getOrderDetail);
storeOrderRouter.post("/:orderNo/accept", orderController.acceptOrder);
storeOrderRouter.post("/:orderNo/start-delivery", orderController.startDelivery);
storeOrderRouter.post("/:orderNo/complete-delivery", orderController.completeDelivery);
storeOrderRouter.post("/:orderNo/reject", orderController.rejectOrder);
storeOrderRouter.post("/:orderNo/cancel", orderController.cancelOrder);

// 挂单
storeHoldOrderRouter.post("/", otherController.createHoldOrder);
storeHoldOrderRouter.get("/", otherController.listHoldOrders);
storeHoldOrderRouter.post("/:holdNo/restore", otherController.restoreHoldOrder);
storeHoldOrderRouter.delete("/:holdNo", otherController.deleteHoldOrder);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**`（含别的文件拥有的路径与不存在的子路径）
//   都被先套上认证 + CSRF。现按「只声明自己拥有的路径段」拆成两条：`/api/store/orders` 与
//   `/api/store/hold-orders`，对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/orders", router: storeOrderRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, auth: "requireAuthWithTenant" },
];
