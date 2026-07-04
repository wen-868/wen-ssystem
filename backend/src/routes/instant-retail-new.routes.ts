import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as platformIntegrationController from "../controllers/instant-retail/platform-integration.controller.js";
import * as orderReceivingController from "../controllers/instant-retail/order-receiving.controller.js";
import * as fulfillmentController from "../controllers/instant-retail/fulfillment.controller.js";
import * as retailAdminController from "../controllers/admin/instant-retail.controller.js";
import * as analyticsController from "../controllers/instant-retail/analytics.controller.js";
import * as reviewController from "../controllers/instant-retail/review.controller.js";
import * as reconciliationController from "../controllers/instant-retail/reconciliation.controller.js";

export const instantRetailRouter = Router();

const storeAuth = [requireAuthWithTenant, (req: any, res: any, next: any) => {
  if (!req.user.storeId && !req.user.roles?.includes("SUPER_ADMIN")) {
    res.status(403).json({ code: "403", message: "无门店权限" });
    return;
  }
  next();
}];

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Webhook 接收端点（无需认证）
 * ──────────────────────────────────────────────────────────────────────────── */

instantRetailRouter.post("/webhook/jd", platformIntegrationController.handleJdWebhook);
instantRetailRouter.post("/webhook/meituan", platformIntegrationController.handleMeituanWebhook);
instantRetailRouter.post("/webhook/eleme", platformIntegrationController.handleElemeWebhook);

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 管理后台端点（需要 requireAuthWithTenant）
 * ──────────────────────────────────────────────────────────────────────────── */

const adminRouter = Router();
instantRetailRouter.use("/admin/instant-retail", requireAuthWithTenant, adminRouter);

// 2.1 平台对接
adminRouter.get("/platforms", platformIntegrationController.getPlatforms);
adminRouter.get("/configs", platformIntegrationController.getConfigs);
adminRouter.get("/configs/:platform", platformIntegrationController.getConfigByPlatform);
adminRouter.post("/configs", platformIntegrationController.upsertConfig);
adminRouter.post("/configs/:platform/test", platformIntegrationController.testConnection);
adminRouter.post("/configs/:platform/sync-orders", platformIntegrationController.syncOrders);
adminRouter.post("/configs/:platform/sync-products", platformIntegrationController.syncProducts);
adminRouter.delete("/configs/:platform", platformIntegrationController.deleteConfig);

// 2.2 门店配置
adminRouter.get("/shop-config", retailAdminController.getShopConfig);
adminRouter.post("/shop-config", retailAdminController.saveShopConfig);

// 2.3 零售分类
adminRouter.get("/categories", retailAdminController.listCategories);
adminRouter.post("/categories", retailAdminController.createCategory);
adminRouter.put("/categories/:id", retailAdminController.updateCategory);
adminRouter.delete("/categories/:id", retailAdminController.deleteCategory);

// 2.4 零售商品
adminRouter.get("/products", retailAdminController.listRetailProducts);
adminRouter.post("/products", retailAdminController.addRetailProduct);
adminRouter.put("/products/:id", retailAdminController.updateRetailProduct);
adminRouter.delete("/products/:id", retailAdminController.deleteRetailProduct);

// 2.5 零售订单
adminRouter.get("/orders", retailAdminController.listRetailOrders);
adminRouter.get("/orders/:orderNo", retailAdminController.getRetailOrderDetail);
adminRouter.post("/orders/:orderNo/status", retailAdminController.updateRetailOrderStatus);

// 2.6 Banner
adminRouter.get("/banners", retailAdminController.listBanners);
adminRouter.post("/banners", retailAdminController.createBanner);
adminRouter.put("/banners/:id", retailAdminController.updateBanner);
adminRouter.delete("/banners/:id", retailAdminController.deleteBanner);

// 2.7 评价管理
adminRouter.get("/reviews", reviewController.listReviews);
adminRouter.get("/reviews/stats", reviewController.getReviewStats);
adminRouter.get("/reviews/:id", reviewController.getReviewDetail);
adminRouter.post("/reviews/:id/reply", reviewController.replyReview);
adminRouter.post("/reviews/sync", reviewController.syncReviews);

// 2.8 对账管理
adminRouter.get("/reconciliation/summary", reconciliationController.getReconciliationSummary);
adminRouter.get("/reconciliation/records", reconciliationController.listReconciliationRecords);

// 2.9 零售经营分析
adminRouter.get("/reports/summary", analyticsController.getAnalyticsSummary);
adminRouter.get("/reports/trend", analyticsController.getSalesTrend);
adminRouter.get("/reports/platform-compare", analyticsController.getPlatformComparison);
adminRouter.get("/reports/top-products", analyticsController.getTopProducts);

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 门店端端点（需要 storeAuth）
 * ──────────────────────────────────────────────────────────────────────────── */

const storeRouter = Router();
instantRetailRouter.use("/store/instant-retail", ...storeAuth, storeRouter);

storeRouter.get("/orders", orderReceivingController.listOrders);
storeRouter.get("/orders/:platformOrderId", orderReceivingController.getOrderDetail);
storeRouter.post("/orders/:platformOrderId/confirm", orderReceivingController.confirmOrder);
storeRouter.post("/orders/:platformOrderId/cancel", orderReceivingController.cancelOrder);
storeRouter.post("/orders/:platformOrderId/start-delivery", fulfillmentController.startDelivery);
storeRouter.post("/orders/:platformOrderId/complete-delivery", fulfillmentController.completeDelivery);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/instant-retail",
  router: instantRetailRouter,
  auth: "requireAuthWithTenant",
};
