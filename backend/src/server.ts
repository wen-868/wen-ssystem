import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./shared/logger.js";
import { env } from "./shared/env.js";
import { initDatabase } from "./shared/db.js";
import { errorHandler } from "./shared/error-handler.js";
import { errorResponseInterceptor } from "./shared/error-response-interceptor.js";
import { responseTimeTracker } from "./shared/response-time-tracker.js";
import { requireAuthWithTenant } from "./shared/auth.js";
import { runMigrations } from "./shared/migration.js";
import { setupRoutes } from "./shared/auto-routes.js";
import * as authController from "./controllers/admin/auth.controller.js";
import { startAlertScheduler } from "./services/alert.service.js";
import { startExpiryScanner } from "./routes/inventory-batch.routes.js";
import { startStoreControlScheduler } from "./routes/store-control.routes.js";
import { startOrderTimeoutScanner } from "./routes/order-timeout.routes.js";
import { startOverdueScanner } from "./services/overdue-scanner.service.js";
import { startSubscriptionExpiryScanner } from "./services/subscription-expiry.service.js";
import "./jobs/report-aggregation.job.js";
import { insertErrorLog } from "./services/admin/error-log.service.js";
import { reportToLingZhou } from "./shared/feishu-report.js";
import { tagRouter } from "./routes/tag.routes.js";
import { platformRouter } from "./routes/platform.routes.js";
import { platformTenantRouter } from "./routes/platform-tenant.routes.js";
import { platformAuthRouter } from "./routes/platform-auth.routes.js";
import { platformMonitorRouter } from "./routes/platform-monitor.routes.js";
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
import { paymentConfigRouter } from "./routes/payment-config.routes.js";
import { miniappConfigRouter } from "./routes/miniapp-config.routes.js";
import syncRouter from "./routes/sync.routes.js";
import { orderSyncLogRouter } from "./routes/miniapp-order-sync.routes.js";
import { platformReconciliationRouter } from "./routes/platform-reconciliation.routes.js";
import { platformReviewRouter } from "./routes/platform-review.routes.js";
import { customReportRouter } from "./routes/custom-report.routes.js";

const app = express();

// 全局未捕获异常
process.on("uncaughtException", (err: Error) => {
  console.error("💥 [uncaughtException] 未捕获的异常:", err);
  insertErrorLog({
    error_type: "uncaughtException",
    severity: "FATAL",
    message: err.message || "未捕获的异常",
    stack: err.stack || undefined,
  }).catch(() => {});
  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[FATAL] uncaughtException: ${err.message || "未捕获的异常"}`,
    details: [
      { label: "错误类型", value: "uncaughtException" },
      { label: "错误消息", value: err.message || "未知" },
      { label: "堆栈", value: (err.stack || "").split("\n").slice(0, 5).join("\n") },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch(() => {});
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("💥 [unhandledRejection] 未处理的 Promise 拒绝:", reason);
  const message = reason?.message || String(reason) || "未处理的 Promise 拒绝";
  const stack = reason?.stack || undefined;
  insertErrorLog({
    error_type: "unhandledRejection",
    severity: "ERROR",
    message,
    stack,
  }).catch(() => {});
  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[ERROR] unhandledRejection: ${message}`,
    details: [
      { label: "错误类型", value: "unhandledRejection" },
      { label: "错误消息", value: message },
      { label: "堆栈", value: (stack || "").split("\n").slice(0, 5).join("\n") || "N/A" },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch(() => {});
});

// 测试环境不禁用限流，避免影响测试
if (process.env.NODE_ENV !== "test") {
  // 全局 Rate Limiting：每IP每分钟100请求
  app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
}
// 登录接口 Rate Limiting：每IP每15分钟5次（防暴力破解）
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, message: "登录请求过于频繁，请15分钟后再试", standardHeaders: true, legacyHeaders: false });

app.use(helmet());
const corsOriginsEnv = (globalThis as typeof globalThis & { process: NodeJS.Process }).process?.env?.CORS_ORIGINS;
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map((s: string) => s.trim())
  : ["https://admin.onepan.cn", "https://m.onepan.cn", "https://store.onepan.cn"];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(responseTimeTracker);
app.use(errorResponseInterceptor);

// 公开健康检查（无需认证，供外部监控使用）
app.get("/api/platform/health", (_req, res) => {
  res.json({ code: "0", data: { status: "healthy", timestamp: new Date().toISOString() } });
});

app.get("/health", (_req: any, res: any) => {
  res.json({ code: "0", message: "ok", data: { service: "zhixiang-backend" } });
});

// 登录接口（无需认证，但受 Rate Limiting 保护）
app.post("/api/admin/auth/login", loginLimiter, authController.login);
app.post("/api/store/auth/login", loginLimiter, authController.login);
// 认证后的用户接口
app.get("/api/admin/auth/me", requireAuthWithTenant, authController.getMe);
app.get("/api/admin/auth/settings", requireAuthWithTenant, authController.getSettings);
app.put("/api/admin/auth/settings", requireAuthWithTenant, authController.updateSettings);
app.post("/api/admin/auth/change-password", requireAuthWithTenant, authController.changePassword);

// 自动发现并注册 routes/ 目录下所有路由
await setupRoutes(app);

app.use(errorHandler);

async function start() {
  if (!env.USE_MOCK_DB) {
    await initDatabase();
    await runMigrations();
  }

  app.listen(env.PORT, () => {
    logger.info(`zhixiang-backend listening on http://localhost:${env.PORT}`);
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

// 仅在非测试环境启动 server（测试环境由 supertest 自行管理连接）
if (process.env.NODE_ENV !== "test") {
  start().catch((error: any) => {
    logger.error("❌ 后端启动失败:", error);
    (globalThis as typeof globalThis & { process: NodeJS.Process }).process?.exit(1);
  });
}

export { app };
