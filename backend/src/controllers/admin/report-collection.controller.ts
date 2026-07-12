import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/report-collection.service";

export const getCollectionFunnel = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getCollectionFunnel({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getChannelConversion = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getChannelConversion({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getCollectionTimeout = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getCollectionTimeout({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getCollectionDailyTrend = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getCollectionDailyTrend({ tenantId: req.tenantId!, startDate, endDate, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});

export const getCollectionSummary = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.query as Record<string, string | undefined>;
  const result = await svc.getCollectionSummary({ tenantId: req.tenantId!, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});