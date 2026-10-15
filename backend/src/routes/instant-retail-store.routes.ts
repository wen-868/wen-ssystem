import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller";
import { requireStoreAuth } from "../middleware/store-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requirePermission } from "../middleware/rbac-auth";

export const instantRetailStoreRouter = Router();

instantRetailStoreRouter.use(...requireStoreAuth);

instantRetailStoreRouter.get("/orders", orderReceivingController.listOrders);
instantRetailStoreRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
// ========== 写端点 CSRF 防护（S3-178 #2） ==========
// L10 的 requireStoreAuth = [...requireAuthWithTenant, 门店校验]（middleware/store-auth.ts:5-14），
// 认证已在前；csrfMiddleware 依赖 req.user，故只能挂在其后（顺序不得颠倒）。S3-177 同款写法。
// S3-224（第 43 项 B2 批 6 · 销售域接线）：4 条补端点级权限码（顺序 认证 → CSRF → 权限，与 S3-177 同款）——
// 接单/开始配送/完成配送挂 `sale:create`，拒单挂 `sale:void`（与 store-order.routes.ts 门店订单同族同口径）。
// 使用者：**全仓无调用点**（`rg '/store/instant-retail'` 在 admin-web / app-mobile / miniapp / saas-admin
// 零命中；admin-web 的即时零售 11 个页面走的是 `/admin/instant-retail/**`）⇒ 接线仅收口 API 面、不改任何页面行为。
// 生产持有 `sale:create` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / STORE_OPERATOR / SALES_STAFF，
// `sale:void` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER ⇒ 均 ⊇ 门店端使用者画像。2026-10-16
instantRetailStoreRouter.post("/orders/:platformOrderId/confirm", csrfMiddleware, requirePermission("sale:create"), orderReceivingController.confirmOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/cancel", csrfMiddleware, requirePermission("sale:void"), orderReceivingController.cancelOrder);
instantRetailStoreRouter.post("/orders/:platformOrderId/start-delivery", csrfMiddleware, requirePermission("sale:create"), fulfillmentController.startDelivery);
instantRetailStoreRouter.post("/orders/:platformOrderId/complete-delivery", csrfMiddleware, requirePermission("sale:create"), fulfillmentController.completeDelivery);

export const routeConfig: RouteConfig = {
  prefix: "/api/store/instant-retail",
  router: instantRetailStoreRouter,
  auth: "none",
};
