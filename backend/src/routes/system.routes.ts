import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { queryOne } from "../shared/db.js";
import { ok, fail } from "../shared/response.js";
import { env } from "../shared/env.js";
import { runMigrations } from "../shared/migration.js";
import logger from "../shared/logger.js";

export const systemRouter = Router();

// ========== 系统健康检查（无需认证） ==========
systemRouter.get("/health", asyncHandler(async (_req, res) => {
  res.json(ok({
    status: "UP",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV || "development",
    uptime: (Date.now() - ((globalThis as { __startTime?: number }).__startTime ?? 0)) / 1000,
  }));
}));

// ========== 系统信息（需认证） ==========
systemRouter.get("/info", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const [userCount, roleCount, configCount] = await Promise.all([
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM t_sys_user WHERE tenant_id = ?", [tenantId]),
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM t_sys_role WHERE tenant_id = ?", [tenantId]),
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM t_sys_config WHERE tenant_id = ?", [tenantId]),
  ]);

  res.json(ok({
    tenantId,
    userCount: userCount?.cnt ?? 0,
    roleCount: roleCount?.cnt ?? 0,
    configCount: configCount?.cnt ?? 0,
  }));
}));

// ========== 数据库迁移（临时，部署后手动触发） ==========
systemRouter.post("/migrate", asyncHandler(async (_req, res) => {
  const logs: string[] = [];
  const origInfo = (logger as any).info;
  const origError = (logger as any).error;

  // 临时劫持 pino logger 输出，捕获迁移日志
  (logger as any).info = (...args: any[]) => { logs.push(args.join(" ")); origInfo(...args); };
  (logger as any).error = (...args: any[]) => { logs.push("ERROR: " + args.join(" ")); origError(...args); };

  try {
    await runMigrations();
    (logger as any).info = origInfo;
    (logger as any).error = origError;
    res.json(ok({ result: "迁移执行成功", logs }));
  } catch (e: any) {
    (logger as any).info = origInfo;
    (logger as any).error = origError;
    res.status(500).json({ ...fail(`迁移失败: ${e.message}`, "500"), logs });
  }
}));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/system",
  router: systemRouter,
  auth: "none",
};
