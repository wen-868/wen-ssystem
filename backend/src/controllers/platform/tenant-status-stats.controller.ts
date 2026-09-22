import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { getTenantStatusStats } from "../../services/platform/tenant-status-stats.service";

/**
 * C1-2 A1：GET /api/platform/tenants/stats
 * 各状态租户计数（只读聚合，按设计跨租户；见 service 文件头取证）
 */
export const getTenantStatusStatsCtrl = asyncHandler(async (_req, res) => {
  const result = await getTenantStatusStats();
  res.json(ok(result));
});
