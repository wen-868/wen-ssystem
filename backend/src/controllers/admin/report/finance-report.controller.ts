import { asyncHandler } from "../../../middleware/async-handler";
import { ok } from "../../../shared/response";
import * as financeReportService from "../../../services/admin/report/finance-report.service";

export const getReceivablePayable = asyncHandler(async (req, res) => {
  const result = await financeReportService.getReceivablePayable(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined
  );
  res.json(ok(result));
});

export const getPaymentAnalysis = asyncHandler(async (req, res) => {
  const result = await financeReportService.getPaymentAnalysis(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    (req.query.groupBy as "date" | "customer" | "staff") || "date"
  );
  res.json(ok(result));
});

export const getProfit = asyncHandler(async (req, res) => {
  const result = await financeReportService.getProfit(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined
  );
  res.json(ok(result));
});
