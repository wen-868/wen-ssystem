import { asyncHandler } from "../../../middleware/async-handler.js";
import { ok } from "../../../shared/response.js";
import * as staffReportService from "../../../services/admin/report/staff-report.service.js";

export const getStaffPerformanceRanking = asyncHandler(async (req, res) => {
  const result = await staffReportService.getStaffPerformanceRanking(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    Number(req.query.limit || 20)
  );
  res.json(ok(result));
});
