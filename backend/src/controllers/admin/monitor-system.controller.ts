import { ok } from "../../shared/response";
import {
  getMemoryUsage,
  getCpuUsage,
  getProcessInfo,
  getSystemHealth,
} from "../../services/admin/system-monitor.service";

/** 获取系统资源信息 */
export async function getSystemResources(_req: any, res: any) {
  const memory = getMemoryUsage();
  const cpu = getCpuUsage();
  const processInfo = getProcessInfo();
  res.json(ok({ memory, cpu, process: processInfo }));
}

/** 综合健康检查 */
export async function checkSystemHealth(_req: any, res: any) {
  const health = await getSystemHealth();
  res.json(ok(health));
}
