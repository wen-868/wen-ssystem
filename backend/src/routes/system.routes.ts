import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";
import { env } from "../shared/env.js";
import { runMigrations } from "../shared/migration.js";

export const systemRouter = Router();

// ========== 系统健康检查（无需认证） ==========
systemRouter.get("/health", asyncHandler(async (_req, res) => {
  res.json(ok({
    status: "UP",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV || "development",
    uptime: (Date.now() - (globalThis as any).__startTime || 0) / 1000,
  }));
}));

// ========== 系统信息（需认证） ==========
systemRouter.get("/info", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const [userCount, roleCount, configCount] = await Promise.all([
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM sys_user WHERE tenant_id = ?", [tenantId]),
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM sys_role WHERE tenant_id = ?", [tenantId]),
    queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM sys_config WHERE tenant_id = ?", [tenantId]),
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
  try {
    await runMigrations();
    res.json(ok({ result: "迁移执行成功" }));
  } catch (e: any) {
    res.status(500).json({ code: "500", message: `迁移失败: ${e.message}` });
  }
}));