import { queryOne } from "../shared/db";
import { ok, fail } from "../shared/response";
import { env } from "../shared/env";
import { runMigrations } from "../shared/migration";
import logger from "../shared/logger";

export async function healthCheck(_req: any, res: any) {
  res.json(ok({
    status: "UP",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV || "development",
    uptime: (Date.now() - ((globalThis as { __startTime?: number }).__startTime ?? 0)) / 1000,
  }));
}

export async function getSystemInfo(req: any, res: any) {
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
}

export async function runSystemMigration(_req: any, res: any) {
  const logs: string[] = [];
  const origInfo = (logger as any).info;
  const origError = (logger as any).error;

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
}
