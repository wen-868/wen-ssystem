import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { getUpgradeFlowReport } from "../../services/platform/plan-upgrade-flow.service";

/**
 * C1-2 B1：GET /api/platform/plans/upgrade-flow-report
 * 套餐升降级流向报表（只读聚合）；range 非法 → 400；无记录 → 空数组（前端空态）
 */
export const getUpgradeFlowReportCtrl = asyncHandler(async (req, res) => {
  const result = await getUpgradeFlowReport(req.query.range);
  res.json(ok(result));
});
