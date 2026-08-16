import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import logger from "./shared/logger";
import { env } from "./shared/env";
import { initDatabase } from "./shared/db";
import { ok } from "./shared/response";
import { errorHandler } from "./middleware/error-handler";
import { errorResponseInterceptor } from "./shared/error-response-interceptor";
import { responseTimeTracker } from "./middleware/response-tracker";
import { runMigrations } from "./shared/migration";
import { setupRoutes } from "./shared/auto-routes";
import * as authController from "./controllers/admin/auth.controller";
import * as orderController from "./controllers/admin/order.controller";
import { requireAuthWithTenant } from "./middleware/auth";
import { startAlertScheduler } from "./services/alert.service";
import { startStoreControlScheduler } from "./shared/store-control-scheduler";
import { startOrderTimeoutScanner } from "./services/admin/order-timeout.service";
import { startOverdueScanner } from "./services/overdue-scanner.service";
import { startSubscriptionExpiryScanner } from "./services/subscription-expiry.service";
import expressStatic from "express";
import { avatarDir } from "./controllers/admin/avatar.controller";
import { productImageDir } from "./controllers/admin/product-image.controller";
import "./jobs/report-aggregation.job.js";
import "./jobs/auto-backup.job.js";
import { insertErrorLog, cleanupOldLogs } from "./services/admin/error-log.service";
import { reportToLingZhou } from "./shared/feishu-report";
import cron from "node-cron";
// 路由已通过 auto-routes 自动注册，此处不再手动导入

const app = express();

// 生产环境 Nginx 反向代理需要信任 X-Forwarded-For 头，否则 express-rate-limit 会抛出 ValidationError
app.set("trust proxy", 1);

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
    webhookUrl: env.FEISHU_ALERT_WEBHOOK_URL || undefined,
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
    webhookUrl: env.FEISHU_ALERT_WEBHOOK_URL || undefined,
  }).catch(() => { });
});

/**
 * 创建限流器（R55-03）
 *
 * 存储策略：
 *  - 测试环境（NODE_ENV === "test"）或未配置 REDIS_URL：使用默认 MemoryStore（单进程内存）
 *  - 生产环境且配置了 REDIS_URL：使用 RedisStore（多进程共享计数，防暴力破解不因重启/多进程清零）
 *
 * 容错：RedisStore 初始化抛错时降级为 MemoryStore；Redis 运行时连接错误通过 error 事件记录日志。
 * 关联任务：R55-03 rate-limit 使用 MemoryStore
 */
function createRateLimiter(options: NonNullable<Parameters<typeof rateLimit>[0]>) {
  // express-rate-limit v8 默认验证 X-Forwarded-For 头，Nginx 反代下需禁用验证
  // 信任 nginx 反代（app.set("trust proxy", 1) 已启用），限流按真实客户端 IP 计数；
  // 不能禁用 trustProxy，否则所有请求都算到 127.0.0.1，全站共享配额被限流(429)。
  const baseOptions = { standardHeaders: true, legacyHeaders: false, ...options };
  // 测试环境使用 MemoryStore，避免依赖真实 Redis 影响测试
  if (process.env.NODE_ENV === "test") {
    return rateLimit(baseOptions);
  }
  // 未配置 REDIS_URL：开发/单进程环境使用 MemoryStore
  if (!env.REDIS_URL) {
    logger.info("[rate-limit] 未配置 REDIS_URL，限流器使用 MemoryStore（单进程内存）");
    return rateLimit(baseOptions);
  }
  // 生产环境 + REDIS_URL：使用 RedisStore
  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      // Redis 未连接时命令立即失败而非排队，避免请求挂起
      enableOfflineQueue: false,
    });
    client.on("error", (err: Error) => {
      logger.error("[rate-limit] Redis 连接错误:", err.message);
    });
    const store = new RedisStore({
      // ioredis 的 call 签名为 call(command, ...args)，第一个参数是命令名
      // 参考 rate-limit-redis readme 的 ioredis 用法
      sendCommand: (command: string, ...args: string[]) =>
        client.call(command, ...args) as Promise<RedisReply>,
    });
    logger.info("[rate-limit] 限流器启用 RedisStore（REDIS_URL 已配置）");
    return rateLimit({ ...baseOptions, store });
  } catch (err) {
    logger.error(
      "[rate-limit] RedisStore 初始化失败，降级 MemoryStore:",
      err instanceof Error ? err.message : err
    );
    return rateLimit(baseOptions);
  }
}

// 全局限流：生产环境 100 次/分钟/IP；非生产（开发/本地）放宽到 1000，避免脚本测试频繁触发 429
if (process.env.NODE_ENV !== "test") {
  // 全局 Rate Limiting：每IP每分钟600请求（商用标准，避免正常浏览多页面触发429）
  app.use(createRateLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === "production" ? 600 : 2000 }));
}
// 登录接口 Rate Limiting：每IP每15分钟20次（防暴力破解，兼顾测试）
// admin 和 store 登录使用独立实例，避免互相影响计数
// 放宽到 100 次/15分钟：移动端演示登录+多设备共享IP场景频繁登录，20次过严导致误伤429
const loginLimitMax = process.env.NODE_ENV === "production" ? 100 : 1000;
const adminLoginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: loginLimitMax, message: "登录请求过于频繁，请15分钟后再试" });
const storeLoginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: loginLimitMax, message: "登录请求过于频繁，请15分钟后再试" });

app.use(helmet());
// CORS 允许域名：从 env.ts 集中管理（R63 修复 — 原先直接读取 process.env）
const allowedOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map((s: string) => s.trim())
  : true; // 生产环境配置CORS_ORIGINS环境变量；默认允许所有来源
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
// 头像等静态文件（/uploads/avatar/xxx，nginx /uploads 反代到本服务）
app.use("/uploads", expressStatic.static(avatarDir()));
// 商品主图静态文件（/uploads/product-image/xxx）
app.use("/uploads/product-image", expressStatic.static(productImageDir()));
app.use(responseTimeTracker);
app.use(errorResponseInterceptor);

// 公开健康检查（无需认证，供外部监控使用）
app.get("/api/platform/health", (_req, res) => {
  res.json(ok({ status: "healthy", timestamp: new Date().toISOString() }));
});

app.get("/health", (_req: any, res: any) => {
  res.json(ok({ service: "zhixiang-backend" }));
});

// 登录接口（无需认证；应用户要求不限流——演示登录/多设备共享IP场景不再触发429）
// admin/store 登录由 server.ts 手动注册，其他 /api/admin/auth/* 路由（me/settings/change-password）由 admin-auth.routes.ts 自动注册
app.post("/api/admin/auth/login", authController.login);
app.post("/api/admin/auth/demo-login", authController.demoLogin);
app.post("/api/store/auth/login", authController.login);
// MFA 登录二次验证（无鉴权，凭短时效挑战令牌 + 动态码，独立限流防爆破）
app.post("/api/admin/auth/mfa/verify", storeLoginLimiter, authController.verifyMfa);
// 服务账号换发 JWT（运营系统适配层调用，服务端专用；无需 CSRF，由凭证 + 限流保护）
app.post("/api/admin/auth/service-token", adminLoginLimiter, authController.serviceToken);
// 运营系统挂车转化推单受理（服务账号 JWT 鉴权；真实建单待订单业务模块接入）
app.post("/api/admin/orders", requireAuthWithTenant, orderController.acceptExternalOrder);

// CSRF 防护：不再全局注册，避免与 auto-routes 中的按路由注册形成双重注册。
// - 自动注册的路由：auto-routes.ts 的 getAuthMiddlewares 已对 requireAuth/requireAuthWithTenant/requirePlatformAuth 三种模式附加 csrfMiddleware
// - 登录接口：auth:none 路由，req.user 不存在，csrfMiddleware 会自动放行

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
