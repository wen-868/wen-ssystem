import { asyncHandler } from "../../../middleware/async-handler";
import { ok } from "../../../shared/response";
import * as salesReportService from "../../../services/admin/report/sales-report.service";

export const getSalesDaily = asyncHandler(async (req, res) => {
  const result = await salesReportService.getSalesDaily(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const getSalesTrend = asyncHandler(async (req, res) => {
  const result = await salesReportService.getSalesTrend(
    req.tenantId!,
    (req.query.granularity as "month" | "week" | "day") || "month"
  );
  res.json(ok(result));
});

export const getSalesHourlyHeatmap = asyncHandler(async (req, res) => {
  const result = await salesReportService.getSalesHourlyHeatmap(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const getSalesRanking = asyncHandler(async (req, res) => {
  const result = await salesReportService.getSalesRanking(
    req.tenantId!,
    (req.query.dimension as "product" | "customer" | "staff" | "store") || "product",
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    Number(req.query.limit || 20)
  );
  res.json(ok(result));
});

export const getBusinessOverview = asyncHandler(async (req, res) => {
  const result = await salesReportService.getBusinessOverview(req.tenantId!);
  res.json(ok(result));
});
