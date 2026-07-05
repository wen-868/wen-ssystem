import { queryOneWithTenant } from "../../shared/db.js";
import { env } from "../../shared/env.js";

export async function getHealth() {
  return {
    status: "UP",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV || "development",
    uptime: (Date.now() - ((globalThis as unknown as Record<string, unknown>).__startTime as number || 0)) / 1000,
  };
}

export async function getSystemInfo(tenantId: string) {
  const [userCount, roleCount, configCount] = await Promise.all([
    queryOneWithTenant<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sys_user WHERE tenant_id = ?", [tenantId], tenantId
    ),
    queryOneWithTenant<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sys_role WHERE tenant_id = ?", [tenantId], tenantId
    ),
    queryOneWithTenant<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM sys_config WHERE tenant_id = ?", [tenantId], tenantId
    ),
  ]);

  return {
    tenantId,
    userCount: userCount?.cnt ?? 0,
    roleCount: roleCount?.cnt ?? 0,
    configCount: configCount?.cnt ?? 0,
  };
}