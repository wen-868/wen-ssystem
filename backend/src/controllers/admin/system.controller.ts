import { ok, fail } from "../../shared/response";
import * as systemService from "../../services/admin/system.service";
import { runMigrations } from "../../shared/migration";
import logger from "../../shared/logger";

export async function healthCheck(_req: any, res: any) {
  const data = await systemService.getHealth();
  res.json(ok(data));
}

export async function getSystemInfo(req: any, res: any) {
  const tenantId = req.tenantId!;
  const data = await systemService.getSystemInfo(tenantId);
  res.json(ok(data));
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
