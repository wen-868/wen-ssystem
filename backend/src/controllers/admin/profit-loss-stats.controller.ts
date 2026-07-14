import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as profitLossStatsService from "../../services/admin/profit-loss-stats.service";

// 损益统计
export const getProfitLossStats = asyncHandler(async (req, res) => {
  const result = await profitLossStatsService.getProfitLossStats({
    tenantId: req.tenantId!,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
    storeId: req.query.storeId !== undefined ? Number(req.query.storeId) : undefined,
  });
  res.json(ok(result));
});
