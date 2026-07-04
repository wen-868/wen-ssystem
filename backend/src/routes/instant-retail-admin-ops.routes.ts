import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import * as retailAdminController from "../controllers/admin/instant-retail.controller.js";
import * as reviewController from "../controllers/instant-retail/review.controller.js";
import * as reconciliationController from "../controllers/instant-retail/reconciliation.controller.js";
import * as analyticsController from "../controllers/instant-retail/analytics.controller.js";

export const instantRetailAdminOpsRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * 管理后台 - 订单、评价、对账、经营分析
 * ──────────────────────────────────────────────────────────────────────────── */

// 零售订单
instantRetailAdminOpsRouter.get("/orders", retailAdminController.listRetailOrders);
instantRetailAdminOpsRouter.get("/orders/:orderNo", retailAdminController.getRetailOrderDetail);
instantRetailAdminOpsRouter.post("/orders/:orderNo/status", retailAdminController.updateRetailOrderStatus);

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