import { asyncHandler } from "../../../shared/async-handler.js";
import { ok } from "../../../shared/response.js";
import * as customerReportService from "../../../services/admin/report/customer-report.service.js";

export const getCustomerContribution = asyncHandler(async (req, res) => {
  const result = await customerReportService.getCustomerContribution(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20),
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined
  );
  res.json(ok(result));
});
