import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as retailAdminController from "../controllers/admin/instant-retail.controller";
import * as retailExtController from "../controllers/admin/instant-retail-ext.controller";
import * as reviewController from "../controllers/instant-retail/review.controller";
import * as reconciliationController from "../controllers/instant-retail/reconciliation.controller";
import * as analyticsController from "../controllers/instant-retail/analytics.controller";

export const instantRetailAdminOpsRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * 管理后台 - 订单、评价、对账、经营分析
 * ──────────────────────────────────────────────────────────────────────────── */

// 零售订单
instantRetailAdminOpsRouter.get("/orders", retailAdminController.listRetailOrders);
instantRetailAdminOpsRouter.get("/orders/:orderNo", retailAdminController.getRetailOrderDetail);
instantRetailAdminOpsRouter.post("/orders/:orderNo/status", retailAdminController.updateRetailOrderStatus);

// 60 秒接单看板（静态路由）
instantRetailAdminOpsRouter.get("/order-board", retailExtController.getOrderBoard);

// 在线支付记录
instantRetailAdminOpsRouter.get("/payments", retailExtController.listPayments);
instantRetailAdminOpsRouter.get("/payments/:paymentNo", retailExtController.getPaymentDetail);

// 订单中心统计（今日/待处理/异常 + 渠道占比 + 近30天趋势）
instantRetailAdminOpsRouter.get("/order-center-stats", analyticsController.getOrderCenterStats);

// 配送管理（I 配送管理 + M 履约调度）
instantRetailAdminOpsRouter.get("/deliveries", retailExtController.listDeliveries);
instantRetailAdminOpsRouter.post("/deliveries/:deliveryId/assign", retailExtController.assignDelivery);
instantRetailAdminOpsRouter.put("/deliveries/:deliveryId/status", retailExtController.updateDeliveryStatus);

// 评价管理
instantRetailAdminOpsRouter.get("/reviews", reviewController.listReviews);
instantRetailAdminOpsRouter.get("/reviews/stats", reviewController.getReviewStats);
instantRetailAdminOpsRouter.get("/reviews/:id", reviewController.getReviewDetail);
instantRetailAdminOpsRouter.post("/reviews/:id/reply", reviewController.replyReview);
instantRetailAdminOpsRouter.post("/reviews/sync", reviewController.syncReviews);

// 对账管理
instantRetailAdminOpsRouter.get("/reconciliation/summary", reconciliationController.getReconciliationSummary);
instantRetailAdminOpsRouter.get("/reconciliation/records", reconciliationController.listReconciliationRecords);

// 零售经营分析
instantRetailAdminOpsRouter.get("/reports/summary", analyticsController.getAnalyticsSummary);
instantRetailAdminOpsRouter.get("/reports/trend", analyticsController.getSalesTrend);
instantRetailAdminOpsRouter.get("/reports/platform-compare", analyticsController.getPlatformComparison);
instantRetailAdminOpsRouter.get("/reports/top-products", analyticsController.getTopProducts);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/instant-retail",
  router: instantRetailAdminOpsRouter,
  auth: "requireAuthWithTenant",
};
