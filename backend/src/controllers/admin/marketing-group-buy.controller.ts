import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as groupBuyService from "../../services/admin/marketing-group-buy.service.js";

export const createGroupBuy = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    productId: z.number().int().positive(),
    skuId: z.number().int().positive(),
    groupPrice: z.number().min(0),
    originalPrice: z.number().min(0),
    minGroupSize: z.number().int().min(2),
    maxGroupSize: z.number().int().min(2),
    timeLimitHours: z.number().int().min(1).default(24),
    totalStock: z.number().int().min(0),
    startTime: z.string().min(1),
    endTime: z.string().min(1)
  }).parse(req.body);

  const result = await groupBuyService.createGroupBuy(body, req.tenantId!);
  res.json(ok(result));
});

export const listGroupBuys = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;

  const result = await groupBuyService.listGroupBuys(page, pageSize, req.tenantId!, status);
  res.json(ok(result));
});

export const getGroupBuy = asyncHandler(async (req, res) => {
  const result = await groupBuyService.getGroupBuy(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateGroupBuy = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    productId: z.number().int().positive().optional(),
    skuId: z.number().int().positive().optional(),
    groupPrice: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    minGroupSize: z.number().int().min(2).optional(),
    maxGroupSize: z.number().int().min(2).optional(),
    timeLimitHours: z.number().int().min(1).optional(),
    totalStock: z.number().int().min(0).optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional()
  }).parse(req.body);

  const result = await groupBuyService.updateGroupBuy(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteGroupBuy = asyncHandler(async (req, res) => {
  const result = await groupBuyService.deleteGroupBuy(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const activateGroupBuy = asyncHandler(async (req, res) => {
  const result = await groupBuyService.activateGroupBuy(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const listGroupBuyTeams = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const activityId = req.query.activityId ? Number(req.query.activityId) : undefined;
  const status = req.query.status as string | undefined;

  const result = await groupBuyService.listGroupBuyTeams(
    page,
    pageSize,
    req.tenantId!,
    activityId,
    status
  );
  res.json(ok(result));
});

export const listActiveGroupBuys = asyncHandler(async (req, res) => {
  const result = await groupBuyService.listActiveGroupBuys(req.tenantId!);
  res.json(ok(result));
});

export const createGroupBuyTeam = asyncHandler(async (req, res) => {
  const activityId = Number(req.params.id);
  const body = z.object({
    userId: z.number().int().positive(),
    quantity: z.number().int().min(1).default(1)
  }).parse(req.body);

  const result = await groupBuyService.createGroupBuyTeam(
    activityId,
    body.userId,
    body.quantity,
    req.tenantId!
  );
  res.json(ok(result));
});

export const getGroupBuyTeam = asyncHandler(async (req, res) => {
  const teamId = Number(req.params.teamId);
  const result = await groupBuyService.getGroupBuyTeam(teamId, req.tenantId!);
  res.json(ok(result));
});

export const joinGroupBuyTeam = asyncHandler(async (req, res) => {
  const teamId = Number(req.params.teamId);
  const body = z.object({
    userId: z.number().int().positive(),
    quantity: z.number().int().min(1).default(1)
  }).parse(req.body);

  const result = await groupBuyService.joinGroupBuyTeam(
    teamId,
    body.userId,
    body.quantity,
    req.tenantId!
  );
  res.json(ok(result));
});
