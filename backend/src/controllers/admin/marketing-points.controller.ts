import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as pointsService from "../../services/admin/marketing-points.service.js";

export const getPointsRule = asyncHandler(async (req, res) => {
  const result = await pointsService.getPointsRule(req.tenantId!);
  res.json(ok(result));
});

export const updatePointsRule = asyncHandler(async (req, res) => {
  const body = z.object({
    earnRatio: z.number().min(0).optional(),
    redeemRatio: z.number().min(0).optional(),
    minRedeemAmount: z.number().min(0).optional(),
    maxRedeemRatio: z.number().min(0).max(1).optional(),
    expireDays: z.number().int().min(0).optional(),
    enabled: z.boolean().optional()
  }).parse(req.body);

  const result = await pointsService.updatePointsRule(body, req.tenantId!);
  res.json(ok(result));
});

export const listPointsRecords = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const type = req.query.type as string | undefined;

  const result = await pointsService.listPointsRecords(page, pageSize, req.tenantId!, userId, type);
  res.json(ok(result));
});

export const getUserPoints = asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const result = await pointsService.getUserPoints(userId, req.tenantId!);
  res.json(ok(result));
});

export const listMyPointsRecords = asyncHandler(async (req, res) => {
  const userId = Number(req.user?.id || req.query.userId || 0);
  if (!userId) {
    res.status(400).json(fail("缺少用户ID", "400"));
    return;
  }
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type as string | undefined;

  const result = await pointsService.listMyPointsRecords(userId, page, pageSize, req.tenantId!, type);
  res.json(ok(result));
});
