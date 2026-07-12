import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/marketing-dashboard.service";

export const getMarketingOverview = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as Record<string, string | undefined>;
  const result = await svc.getMarketingOverview({ tenantId: req.tenantId!, startDate, endDate });
  res.json(ok(result));
});

export const getActivityStats = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, activityType } = req.query as Record<string, string | undefined>;
  const result = await svc.getActivityStats({ tenantId: req.tenantId!, startDate, endDate, activityType });
  res.json(ok(result));
});

export const getSingleActivityStats = asyncHandler(async (req: Request, res: Response) => {
  const { activityType } = req.query as Record<string, string | undefined>;
  const result = await svc.getSingleActivityStats(Number(req.params.activityId), activityType ?? "coupon", req.tenantId!);
  res.json(ok(result));
});

export const getCouponStats = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getCouponStats(req.tenantId!);
  res.json(ok(result));
});

export const getMarketingTrend = asyncHandler(async (req: Request, res: Response) => {
  const { period, startDate, endDate } = req.query as Record<string, string | undefined>;
  const result = await svc.getMarketingTrend({ tenantId: req.tenantId!, period, startDate, endDate });
  res.json(ok(result));
});

export const getActivityRanking = asyncHandler(async (req: Request, res: Response) => {
  const { rankBy, startDate, endDate } = req.query as Record<string, string | undefined>;
  const result = await svc.getActivityRanking({ tenantId: req.tenantId!, rankBy, startDate, endDate });
  res.json(ok(result));
});

export const getActivityComparison = asyncHandler(async (req: Request, res: Response) => {
  const { activityIds, startDate, endDate } = req.query as Record<string, string | undefined>;
  const ids = activityIds ? (Array.isArray(activityIds) ? activityIds.map(Number) : [Number(activityIds)]) : [];
  const result = await svc.getActivityComparison({ tenantId: req.tenantId!, activityIds: ids, startDate, endDate });
  res.json(ok(result));
});