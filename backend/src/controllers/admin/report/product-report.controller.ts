import { asyncHandler } from "../../../middleware/async-handler";
import { ok } from "../../../shared/response";
import * as productReportService from "../../../services/admin/report/product-report.service";

export const getInventorySummary = asyncHandler(async (req, res) => {
  const result = await productReportService.getInventorySummary(
    req.tenantId!,
    (req.query.groupBy as "product" | "store") || "product",
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const getInventoryTurnover = asyncHandler(async (req, res) => {
  const result = await productReportService.getInventoryTurnover(
    req.tenantId!,
    Number(req.query.months || 3)
  );
  res.json(ok(result));
});

export const getInventoryAge = asyncHandler(async (req, res) => {
  const result = await productReportService.getInventoryAge(
    req.tenantId!,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const getPurchaseSummary = asyncHandler(async (req, res) => {
  const result = await productReportService.getPurchaseSummary(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined
  );
  res.json(ok(result));
});

export const getSupplierRanking = asyncHandler(async (req, res) => {
  const result = await productReportService.getSupplierRanking(
    req.tenantId!,
    req.query.dateStart as string | undefined,
    req.query.dateEnd as string | undefined,
    Number(req.query.limit || 20)
  );
  res.json(ok(result));
});
