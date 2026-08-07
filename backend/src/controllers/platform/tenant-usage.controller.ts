import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/tenant-usage.service";

/** GET /api/platform/tenants/usage-stats - 租户使用统计 */
export const getUsageStatsCtrl = asyncHandler(async (req, res) => {
  const params = z.object({
    tenantId: z.string().optional(),
    metric: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    period: z.enum(["day", "week", "month"]).optional(),
  }).parse(req.query);

  const result = await service.getUsageStats(params);
  res.json(ok(result));
});

/** GET /api/platform/tenants/rank - 租户使用排行 */
export const getRankCtrl = asyncHandler(async (req, res) => {
  const params = z.object({
    sortBy: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
  }).parse(req.query);

  const result = await service.getRank(params);
  res.json(ok(result));
});
