import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/instant-retail/retail-analytics.service";

export const getAnalyticsSummary = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getAnalyticsSummary({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getSalesTrend = asyncHandler(async (req: Request, res: Response) => {
  const { period, startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getSalesTrend({ tenantId: req.tenantId!, period, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getPlatformComparison = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getPlatformComparison({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId, limit } = req.query as Record<string, string | undefined>;
  const result = await svc.getTopProducts({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined, limit: limit ? Number(limit) : 10 });
  res.json(ok(result));
});