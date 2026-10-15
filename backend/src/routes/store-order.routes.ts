import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as orderController from "../controllers/store/order.controller";
import * as otherController from "../controllers/store/other.controller";

export const storeOrderRouter = Router();
export const storeHoldOrderRouter = Router();

// 订单
storeOrderRouter.get("/", orderController.listOrders);
storeOrderRouter.get("/:orderNo", orderController.getOrderDetail);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：门店接单/拒单/完成配送挂 `sale:create`，订单取消挂 `sale:void`。
// 依据（逐条）：接单/拒单/完成配送的使用者是 admin-web `pos/OrderFulfillView.vue:150/163/176`
//（页面 `router/index.ts:262` 角色 = SUPER_ADMIN / STORE_MANAGER / **STORE_OPERATOR**）⇒ 必须覆盖收银员；
// 生产持有里**只有 `sale:create` 覆盖 STORE_OPERATOR**（`sale:edit`/`sale:void` 均不覆盖）⇒ 三条取 `sale:create`。
// 订单取消：`sale:void`（作废语义，高风险动作不扩给收银员；本行全仓无页面调用点）。详见
// docs/evidence/S3-224/01-plan-and-judgements.md 与 05-prod-holders.txt。
// ⚠️ 本文件 `POST /:orderNo/start-delivery` 与 `POST /hold-orders/`（创建挂单）本批**不接**：
// 前者有 app-mobile `pages/orders/order-detail.vue:258` 写调用点、后者有 `pages/sales/create-sale.vue:2013`
//（该页经首页快捷入口 `home.vue:69` 无条件可达）⇒ 使用者集合不可枚举（B 类）。
// 2026-10-16
storeOrderRouter.post("/:orderNo/accept", requirePermission("sale:create"), orderController.acceptOrder);
storeOrderRouter.post("/:orderNo/start-delivery", orderController.startDelivery);
storeOrderRouter.post("/:orderNo/complete-delivery", requirePermission("sale:create"), orderController.completeDelivery);
storeOrderRouter.post("/:orderNo/reject", requirePermission("sale:create"), orderController.rejectOrder);
storeOrderRouter.post("/:orderNo/cancel", requirePermission("sale:void"), orderController.cancelOrder);

// 挂单
storeHoldOrderRouter.post("/", otherController.createHoldOrder);
storeHoldOrderRouter.get("/", otherController.listHoldOrders);
// 挂单恢复 / 删除挂单：使用者 = `pos/HoldOrderView.vue:83/96` 与 `pos/CashierView.vue:1689/1709`
//（同页角色含 **STORE_OPERATOR**，`router/index.ts:265/259`）⇒ 同取 `sale:create`。
storeHoldOrderRouter.post("/:holdNo/restore", requirePermission("sale:create"), otherController.restoreHoldOrder);
storeHoldOrderRouter.delete("/:holdNo", requirePermission("sale:create"), otherController.deleteHoldOrder);

// ========== 路由自动发现配置 ==========
// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**`（含别的文件拥有的路径与不存在的子路径）
//   都被先套上认证 + CSRF。现按「只声明自己拥有的路径段」拆成两条：`/api/store/orders` 与
//   `/api/store/hold-orders`，对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/orders", router: storeOrderRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, auth: "requireAuthWithTenant" },
];
