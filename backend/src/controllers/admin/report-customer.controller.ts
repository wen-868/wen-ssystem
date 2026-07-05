import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/report-customer.service.js";

export const getRepurchaseAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getRepurchaseAnalysis({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getAvgOrderValueDistribution = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getAvgOrderValueDistribution({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getRFMAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getRFMAnalysis({ tenantId: req.tenantId!, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getCustomerContributionRanking = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId, limit } = req.query as Record<string, string | undefined>;
  const result = await svc.getCustomerContributionRanking({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined, limit: limit ? Number(limit) : 20 });
  res.json(ok(result));
});

export const getNewCustomerTrend = asyncHandler(async (req: Request, res: Response) => {
  const { groupBy, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getNewCustomerTrend({ tenantId: req.tenantId!, groupBy, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getLostCustomerAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { daysThreshold, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getLostCustomerAnalysis({ tenantId: req.tenantId!, daysThreshold: daysThreshold ? Number(daysThreshold) : 90, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});