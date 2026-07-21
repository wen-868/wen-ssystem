import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./shared/logger";
import { env } from "./shared/env";
import { initDatabase } from "./shared/db";
import { ok } from "./shared/response";
import { errorHandler } from "./middleware/error-handler";
import { errorResponseInterceptor } from "./shared/error-response-interceptor";
import { responseTimeTracker } from "./middleware/response-tracker";
import { requireAuthWithTenant } from "./middleware/auth";
import { csrfMiddleware } from "./middleware/csrf";
import { runMigrations } from "./shared/migration";
import { setupRoutes } from "./shared/auto-routes";
import * as authController from "./controllers/admin/auth.controller";
import { startAlertScheduler } from "./services/alert.service";
import { startStoreControlScheduler } from "./shared/store-control-scheduler";
import { startOrderTimeoutScanner } from "./services/admin/order-timeout.service";
import { startOverdueScanner } from "./services/overdue-scanner.service";
import { startSubscriptionExpiryScanner } from "./services/subscription-expiry.service";
import "./jobs/report-aggregation.job.js";
import { insertErrorLog, cleanupOldLogs } from "./services/admin/error-log.service";
import { reportToLingZhou } from "./shared/feishu-report";
import cron from "node-cron";
// 路由已通过 auto-routes 自动注册，此处不再手动导入

const app = express();

// 全局未捕获异常
process.on("uncaughtException", (err: Error) => {
  logger.error("💥 [uncaughtException] 未捕获的异常:", err);
  insertErrorLog({
    error_type: "uncaughtException",
    severity: "FATAL",
    message: err.message || "未捕获的异常",
    stack: err.stack || undefined,
  }).catch(() => { });
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
  }).catch(() => { });
});

process.on("unhandledRejection", (reason: any, _promise: Promise<any>) => {
  logger.error("💥 [unhandledRejection] 未处理的 Promise 拒绝:", reason);
  const message = reason?.message || String(reason) || "未处理的 Promise 拒绝";
  const stack = reason?.stack || undefined;
  insertErrorLog({
    error_type: "unhandledRejection",
    severity: "ERROR",
    message,
    stack,
  }).catch(() => { });
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
  }).catch(() => { });
});

// 测试环境不禁用限流，避免影响测试
if (process.env.NODE_ENV !== "test") {
  // 全局 Rate Limiting：每IP每分钟100请求
  app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
}
// 登录接口 Rate Limiting：每IP每15分钟20次（防暴力破解，兼顾测试）
// admin 和 store 登录使用独立实例，避免互相影响计数
const adminLoginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: "登录请求过于频繁，请15分钟后再试", standardHeaders: true, legacyHeaders: false });
const storeLoginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: "登录请求过于频繁，请15分钟后再试", standardHeaders: true, legacyHeaders: false });

app.use(helmet());
const corsOriginsEnv = (globalThis as typeof globalThis & { process: NodeJS.Process }).process?.env?.CORS_ORIGINS;
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map((s: string) => s.trim())
  : true; // 生产环境配置CORS_ORIGINS环境变量；默认允许所有来源
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(responseTimeTracker);
app.use(errorResponseInterceptor);

// 公开健康检查（无需认证，供外部监控使用）
app.get("/api/platform/health", (_req, res) => {
  res.json(ok({ status: "healthy", timestamp: new Date().toISOString() }));
});

app.get("/health", (_req: any, res: any) => {
  res.json(ok({ service: "zhixiang-backend" }));
});

// 登录接口（无需认证，但受 Rate Limiting 保护）
app.post("/api/admin/auth/login", adminLoginLimiter, authController.login);
app.post("/api/store/auth/login", storeLoginLimiter, authController.login);
// 认证后的用户接口
// 注意：手动注册的写操作接口需单独挂载 csrfMiddleware（auto-routes 已对自动注册的路由按 auth 配置附加 CSRF）
app.get("/api/admin/auth/me", requireAuthWithTenant, authController.getMe);
app.get("/api/admin/auth/settings", requireAuthWithTenant, authController.getSettings);
app.put("/api/admin/auth/settings", requireAuthWithTenant, csrfMiddleware, authController.updateSettings);
app.post("/api/admin/auth/change-password", requireAuthWithTenant, csrfMiddleware, authController.changePassword);

// CSRF 防护：不再全局注册，避免与 auto-routes 中的按路由注册形成双重注册。
// - 自动注册的路由：auto-routes.ts 的 getAuthMiddlewares 已对 requireAuth/requireAuthWithTenant/requirePlatformAuth 三种模式附加 csrfMiddleware
// - 手动注册的写操作接口：在上方各自挂载 csrfMiddleware
// - auth: "none" 路由：req.user 不存在，csrfMiddleware 会自动放行，无需全局注册

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
    // 启动门店管控定时检查器
    startStoreControlScheduler();
    // 启动订单超时扫描器
    startOrderTimeoutScanner();
    // 启动赊销超期检测
    startOverdueScanner();
    // 启动订阅到期检测
    startSubscriptionExpiryScanner();
    // 启动 error_logs 定时清理任务（每天凌晨3点执行）
    cron.schedule("0 3 * * *", async () => {
      logger.info("[cron] 开始清理过期错误日志");
      try {
        const deletedCount = await cleanupOldLogs(30);
        logger.info(`[cron] 清理完成，删除了 ${deletedCount} 条过期日志`);
      } catch (error) {
        logger.error("[cron] 清理过期错误日志失败:", error);
      }
    });
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
