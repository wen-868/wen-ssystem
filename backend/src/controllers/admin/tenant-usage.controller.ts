import { z } from "zod";
import { ok } from "../../shared/response";
import * as tenantUsageService from "../../services/admin/tenant-usage.service";

export async function getStats(req: any, res: any) {
  const result = await tenantUsageService.getStats();
  res.json(ok(result));
}

export async function getTrend(req: any, res: any) {
  const params = z.object({
    type: z.enum(["login", "order", "sales"]),
    period: z.enum(["day", "week", "month"]).default("day"),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }).parse(req.query);
  const result = await tenantUsageService.getTrend(params);
  res.json(ok(result));
}

export async function getModuleUsage(req: any, res: any) {
  const result = await tenantUsageService.getModuleUsage();
  res.json(ok(result));
}

export async function getRanking(req: any, res: any) {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
  }).parse(req.query);
  const result = await tenantUsageService.getRanking(params);
  res.json(ok(result));
}
