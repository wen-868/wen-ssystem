import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as reportService from "../../services/admin/report.service.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const result = await reportService.getDashboard(req.tenantId!);
  res.json(ok(result));
});

export const getDailySalesTrend = asyncHandler(async (req, res) => {
  const result = await reportService.getDailySalesTrend(req.tenantId!);
  res.json(ok(result));
});

export const getStoreSalesPerformance = asyncHandler(async (req, res) => {
  const result = await reportService.getStoreSalesPerformance(req.tenantId!);
  res.json(ok(result));
});

export const getInventoryAlerts = asyncHandler(async (req, res) => {
  const result = await reportService.getInventoryAlerts(req.tenantId!);
  res.json(ok(result));
});

export const listInventoryBalance = asyncHandler(async (req, res) => {
  const result = await reportService.listInventoryBalance(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20),
    String(req.query.keyword || ""),
    req.query.storeId ? Number(req.query.storeId) : undefined,
    req.query.category ? Number(req.query.category) : undefined
  );
  res.json(ok(result));
});

export const listInventoryLogs = asyncHandler(async (req, res) => {
  const result = await reportService.listInventoryLogs(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCollectionLinks = asyncHandler(async (req, res) => {
  const result = await reportService.listCollectionLinks(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listPaymentOrders = asyncHandler(async (req, res) => {
  const result = await reportService.listPaymentOrders(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listRefundOrders = asyncHandler(async (req, res) => {
  const result = await reportService.listRefundOrders(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

// ============ 分享链接管理 ============

export const getCollectionLinkStats = asyncHandler(async (req, res) => {
  const result = await reportService.getCollectionLinkStats(req.tenantId!);
  res.json(ok(result));
});

export const revokeCollectionLink = asyncHandler(async (req, res) => {
  try {
    const result = await reportService.revokeCollectionLink(req.params.linkNo, req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json({ code: "400", message: e.message });
  }
});

export const batchCreateCollectionLinks = asyncHandler(async (req, res) => {
  const { billNos, shareChannel, amount, taxEnabled, taxRate, expireHours } = req.body;
  const result = await (await import("../../services/store/sale-bill.service.js")).batchCreateCollectionLinks({
    billNos, shareChannel, amount, taxEnabled, taxRate,
    expireHours: expireHours ?? 72,
    userId: req.user!.id,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

// ============ 销售报表 ============

export const getSalesRanking = asyncHandler(async (req, res) => {
  const result = await reportService.getSalesRanking(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getProductRanking = asyncHandler(async (req, res) => {
  const result = await reportService.getProductRanking(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getSalesTrend = asyncHandler(async (req, res) => {
  const result = await reportService.getSalesTrend(
    req.tenantId!,
    String(req.query.groupBy || "day"),
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

// ============ 采购报表 ============

export const getPurchaseSummary = asyncHandler(async (req, res) => {
  const result = await reportService.getPurchaseSummary(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getPurchaseTrend = asyncHandler(async (req, res) => {
  const result = await reportService.getPurchaseTrend(
    req.tenantId!,
    (req.query.groupBy as string) ?? "day",
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getSupplierRanking = asyncHandler(async (req, res) => {
  const result = await reportService.getSupplierRanking(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});
// ============ 库存报表 ============

export const getInventoryTurnover = asyncHandler(async (req, res) => {
  const result = await reportService.getInventoryTurnover(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getInventoryAge = asyncHandler(async (req, res) => {
  const result = await reportService.getInventoryAge(
    req.tenantId!,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const getInventoryABC = asyncHandler(async (req, res) => {
  const result = await reportService.getInventoryABC(req.tenantId!);
  res.json(ok(result));
});
