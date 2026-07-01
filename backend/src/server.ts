import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./shared/env.js";
import { initDatabase } from "./shared/db.js";
import { errorHandler } from "./shared/error-handler.js";
import { requireAuth } from "./shared/auth.js";
import { tenantMiddleware } from "./shared/tenant.js";
import { adminRouter } from "./routes/admin.routes.js";
import * as authController from "./controllers/admin/auth.controller.js";
import { storeRouter } from "./routes/store.routes.js";
import { miniappRouter } from "./routes/miniapp.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { shareRouter } from "./routes/share.routes.js";
import { instantRetailRouter } from "./routes/instant-retail-new.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { miniappCartRouter } from "./routes/cart.routes.js";
import { miniappAftersaleRouter, adminAftersaleRouter } from "./routes/aftersale.routes.js";
import { startAlertScheduler } from "./services/alert.service.js";
import { inventoryBatchRouter, startExpiryScanner } from "./routes/inventory-batch.routes.js";
import { adminStoreControlRouter, storeStoreControlRouter, startStoreControlScheduler } from "./routes/store-control.routes.js";
import { priceRouter } from "./routes/price.routes.js";
import { creditRouter } from "./routes/credit.routes.js";
import { adminTraceRouter, miniappTraceRouter } from "./routes/trace.routes.js";
import { adminMarketingRouter, miniappMarketingRouter } from "./routes/marketing.routes.js";
import { marketingLimitedDiscountRouter } from "./routes/marketing-limited-discount.routes.js";
import { marketingGiftRuleRouter } from "./routes/marketing-gift-rule.routes.js";
import { marketingPointsMallRouter } from "./routes/marketing-points-mall.routes.js";
import { marketingDashboardRouter } from "./routes/marketing-dashboard.routes.js";
import { marketingMaterialRouter } from "./routes/marketing-material.routes.js";
import { wechatRouter } from "./routes/wechat.routes.js";
import { orderTimeoutRouter, startOrderTimeoutScanner } from "./routes/order-timeout.routes.js";
import { purchasePaymentRouter } from "./routes/purchase-payment.routes.js";
import { rbacRouter } from "./routes/rbac.routes.js";
import { adminNotificationRouter, miniappNotificationRouter } from "./routes/notification.routes.js";
import { adminTransferRouter, storeTransferRouter } from "./routes/transfer.routes.js";
import { adminStockCheckRouter, storeStockCheckRouter } from "./routes/stock-check.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
import { exportRouter } from "./routes/export.routes.js";
import { sysConfigRouter } from "./routes/sys-config.routes.js";
import { supplierRouter } from "./routes/supplier.routes.js";
import { purchaseRouter } from "./routes/purchase.routes.js";
import { saleReturnRouter } from "./routes/sale-return.routes.js";
import { purchaseInStockRouter } from "./routes/purchase-in-stock.routes.js";
import { purchaseReturnRouter } from "./routes/purchase-return.routes.js";
import { customerStatementRouter } from "./routes/customer-statement.routes.js";
import { customerPaymentRouter } from "./routes/customer-payment.routes.js";
import { customerVisitRouter } from "./routes/customer-visit.routes.js";
import { categoryRouter } from "./routes/category.routes.js";
import { brandRouter } from "./routes/brand.routes.js";
import { unitRouter } from "./routes/unit.routes.js";
import { approvalRouter } from "./routes/approval.routes.js";
import { tenantRouter } from "./routes/tenant.routes.js";
import { subscriptionRouter } from "./routes/subscription.routes.js";
import { customerMergeRouter } from "./routes/customer-merge.routes.js";
import { startOverdueScanner } from "./services/overdue-scanner.service.js";
import { startSubscriptionExpiryScanner } from "./services/subscription-expiry.service.js";
import "./jobs/report-aggregation.job.js";
import { tagRouter } from "./routes/tag.routes.js";
import { platformRouter } from "./routes/platform.routes.js";
import { customerPriceRouter } from "./routes/customer-price.routes.js";
import { commissionRouter } from "./routes/commission.routes.js";
import { supplierStatementRouter } from "./routes/supplier-statement.routes.js";
import { purchasePlanRouter } from "./routes/purchase-plan.routes.js";
import { purchaseContractRouter } from "./routes/purchase-contract.routes.js";
import { inventoryCostRouter } from "./routes/inventory-cost.routes.js";
import { stockWarningRouter } from "./routes/stock-warning.routes.js";
import { inventoryLossGainRouter } from "./routes/inventory-loss-gain.routes.js";
import { pointsRouter } from "./routes/points.routes.js";
import { storeValueCardRouter } from "./routes/store-value-card.routes.js";
import { customerTagRouter } from "./routes/customer-tag.routes.js";
import { customerCareRouter } from "./routes/customer-care.routes.js";
import { customerSegmentRouter } from "./routes/customer-segment.routes.js";
import { receiptRouter } from "./routes/receipt.routes.js";
import { paymentNewRouter } from "./routes/payment-new.routes.js";
import { receivableRouter } from "./routes/receivable.routes.js";
import { expenseRouter } from "./routes/expense.routes.js";
import { reconciliationRouter } from "./routes/reconciliation.routes.js";
import { operationLogRouter } from "./routes/operation-log.routes.js";
import { sysUserRouter } from "./routes/sys-user.routes.js";
import { systemRouter } from "./routes/system.routes.js";
import { workbenchRouter } from "./routes/workbench.routes.js";
import paymentConfigRouter from "./routes/payment-config.routes.js";
import miniappConfigRouter from "./routes/miniapp-config.routes.js";
import syncRouter from "./routes/sync.routes.js";

const app = express();

// 全局 Rate Limiting：每IP每分钟100请求
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
// 登录接口 Rate Limiting：每IP每15分钟5次（防暴力破解）
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, message: "登录请求过于频繁，请15分钟后再试", standardHeaders: true, legacyHeaders: false });

app.use(helmet());
const corsOriginsEnv = (globalThis as any).process?.env?.CORS_ORIGINS;
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map((s: string) => s.trim())
  : ["https://admin.onepan.cn", "https://m.onepan.cn", "https://store.onepan.cn"];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// 认证 + 租户隔离组合中间件
const requireAuthWithTenant = (req: any, res: any, next: any) => {
  requireAuth(req, res, (err?: any) => {
    if (err) return;
    tenantMiddleware(req, res, next);
  });
};

app.get("/health", (_req: any, res: any) => {
  res.json({ code: "0", message: "ok", data: { service: "zhixiang-backend" } });
});

app.use("/api/admin/suppliers", requireAuthWithTenant, supplierRouter);
app.use("/api/admin/purchase-orders", requireAuthWithTenant, purchaseRouter);
app.use("/api/store/sale-returns", requireAuthWithTenant, saleReturnRouter);
app.use("/api/admin/sale-returns", requireAuthWithTenant, saleReturnRouter);
// 登录接口（无需认证，但受 Rate Limiting 保护）
app.post("/api/admin/auth/login", loginLimiter, authController.login);
app.post("/api/store/auth/login", loginLimiter, authController.login);
// 认证后的用户接口
app.get("/api/admin/auth/me", requireAuthWithTenant, authController.getMe);
app.get("/api/admin/auth/settings", requireAuthWithTenant, authController.getSettings);
app.put("/api/admin/auth/settings", requireAuthWithTenant, authController.updateSettings);
app.post("/api/admin/auth/change-password", requireAuthWithTenant, authController.changePassword);

app.use("/api/admin", requireAuthWithTenant, adminRouter);
app.use("/api/admin/reports", requireAuthWithTenant, reportRouter);
app.use("/api/admin/alerts", requireAuthWithTenant, alertRouter);
app.use("/api/admin/dashboard", requireAuthWithTenant, dashboardRouter);
app.use("/api/store", storeRouter);
app.use("/api/miniapp", miniappRouter);
app.use("/api/pay", paymentRouter);
app.use("/api/share", shareRouter);
app.use("/api/instant-retail", requireAuthWithTenant, instantRetailRouter);
app.use("/api/miniapp/cart", requireAuthWithTenant, miniappCartRouter);
app.use("/api/miniapp/aftersales", miniappAftersaleRouter);
app.use("/api/admin/aftersales", requireAuthWithTenant, adminAftersaleRouter);
app.use("/api/admin/prices", requireAuthWithTenant, priceRouter);
app.use("/api/admin/credits", requireAuthWithTenant, creditRouter);
app.use("/api/admin/trace", requireAuthWithTenant, adminTraceRouter);
app.use("/api/admin/inventory-batch", requireAuthWithTenant, inventoryBatchRouter);
app.use("/api/admin/store-control", requireAuthWithTenant, adminStoreControlRouter);
app.use("/api/store/control", requireAuthWithTenant, storeStoreControlRouter);
app.use("/api/miniapp/trace", miniappTraceRouter);
app.use("/api/admin/marketing", requireAuthWithTenant, adminMarketingRouter);
app.use("/api/miniapp/marketing", miniappMarketingRouter);
app.use("/api/admin/marketing/limited-discounts", requireAuthWithTenant, marketingLimitedDiscountRouter);
app.use("/api/admin/marketing/gift-rules", requireAuthWithTenant, marketingGiftRuleRouter);
app.use("/api/admin/marketing/points-mall", requireAuthWithTenant, marketingPointsMallRouter);
app.use("/api/admin/marketing/dashboard", requireAuthWithTenant, marketingDashboardRouter);
app.use("/api/admin/marketing/materials", requireAuthWithTenant, marketingMaterialRouter);
app.use("/api/miniapp/wechat", wechatRouter);
app.use("/api/admin/order-timeout", requireAuthWithTenant, orderTimeoutRouter);
app.use("/api/admin/purchase-payments", requireAuthWithTenant, purchasePaymentRouter);
app.use("/api/admin/roles", requireAuthWithTenant, rbacRouter);
app.use("/api/admin/notifications", requireAuthWithTenant, adminNotificationRouter);
app.use("/api/miniapp/notifications", miniappNotificationRouter);
app.use("/api/admin/transfers", requireAuthWithTenant, adminTransferRouter);
app.use("/api/store/transfers", requireAuthWithTenant, storeTransferRouter);
app.use("/api/admin/stock-checks", requireAuthWithTenant, adminStockCheckRouter);
app.use("/api/store/stock-checks", requireAuthWithTenant, storeStockCheckRouter);
app.use("/api/admin/audit-logs", requireAuthWithTenant, auditRouter);
app.use("/api/admin/export", requireAuthWithTenant, exportRouter);
app.use("/api/admin/sys-config", requireAuthWithTenant, sysConfigRouter);
app.use("/api/admin/purchase-in-stocks", requireAuthWithTenant, purchaseInStockRouter);
app.use("/api/admin/purchase-returns", requireAuthWithTenant, purchaseReturnRouter);
app.use("/api/store/customer-statements", requireAuthWithTenant, customerStatementRouter);
app.use("/api/store/customer-payments", requireAuthWithTenant, customerPaymentRouter);
app.use("/api/admin/customer-visits", requireAuthWithTenant, customerVisitRouter);
app.use("/api/admin/products/categories", requireAuthWithTenant, categoryRouter);
app.use("/api/admin/brands", requireAuthWithTenant, brandRouter);
app.use("/api/admin/units", requireAuthWithTenant, unitRouter);
app.use("/api/admin/approval", requireAuthWithTenant, approvalRouter);
app.use("/api/admin/tenants", requireAuthWithTenant, tenantRouter);
app.use("/api/admin/subscriptions", requireAuthWithTenant, subscriptionRouter);
app.use("/api/admin/customer-merge", requireAuthWithTenant, customerMergeRouter);
app.use("/api/admin", requireAuthWithTenant, tagRouter);
app.use("/api/platform", requireAuthWithTenant, platformRouter);
app.use("/api/admin/customer-prices", requireAuthWithTenant, customerPriceRouter);
app.use("/api/admin/commission", requireAuthWithTenant, commissionRouter);
app.use("/api/admin/supplier-statements", requireAuthWithTenant, supplierStatementRouter);
app.use("/api/admin/purchase-plans", requireAuthWithTenant, purchasePlanRouter);
app.use("/api/admin/purchase-contracts", requireAuthWithTenant, purchaseContractRouter);
app.use("/api/admin/inventory", requireAuthWithTenant, inventoryCostRouter);
app.use("/api/admin/inventory", requireAuthWithTenant, inventoryLossGainRouter);
app.use("/api/admin/stock-warnings", requireAuthWithTenant, stockWarningRouter);
app.use("/api/admin/members", requireAuthWithTenant, pointsRouter);
app.use("/api/admin/store-value-cards", requireAuthWithTenant, storeValueCardRouter);
app.use("/api/admin/members/tags", requireAuthWithTenant, customerTagRouter);
app.use("/api/admin/members/care", requireAuthWithTenant, customerCareRouter);
app.use("/api/admin/members/segments", requireAuthWithTenant, customerSegmentRouter);
app.use("/api/admin/receipts", requireAuthWithTenant, receiptRouter);
app.use("/api/admin/payments-new", requireAuthWithTenant, paymentNewRouter);
app.use("/api/admin/receivables", requireAuthWithTenant, receivableRouter);
app.use("/api/admin/expenses", requireAuthWithTenant, expenseRouter);
app.use("/api/admin/reconciliation", requireAuthWithTenant, reconciliationRouter);
app.use("/api/admin/operation-logs", requireAuthWithTenant, operationLogRouter);
app.use("/api/admin/sys-users", requireAuthWithTenant, sysUserRouter);
app.use("/api/system", systemRouter);
app.use("/api/admin", requireAuthWithTenant, workbenchRouter);
app.use("/api/admin/payment-config", requireAuthWithTenant, paymentConfigRouter);
app.use("/api/admin/miniapp", requireAuthWithTenant, miniappConfigRouter);
app.use("/api/admin/sync", requireAuthWithTenant, syncRouter);

app.use(errorHandler);

async function start() {
  if (!env.USE_MOCK_DB) {
    await initDatabase();
  }

  app.listen(env.PORT, () => {
    console.info(`zhixiang-backend listening on http://localhost:${env.PORT}`);
    // 启动预警定时检查
    startAlertScheduler();
    // 启动效期扫描器
    startExpiryScanner();
    // 启动门店管控定时检查器
    startStoreControlScheduler();
    // 启动订单超时扫描器
    startOrderTimeoutScanner();
    // 启动赊销超期检测
    startOverdueScanner();
    // 启动订阅到期检测
    startSubscriptionExpiryScanner();
  });
}

start().catch((error: any) => {
  console.error("❌ 后端启动失败:", error);
  (globalThis as any).process?.exit(1);
});
