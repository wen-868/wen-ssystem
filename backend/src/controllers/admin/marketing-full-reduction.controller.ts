import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as fullReductionService from "../../services/admin/marketing-full-reduction.service.js";

export const createFullReduction = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    rules: z.array(z.object({
      minAmount: z.number().min(0),
      reduceAmount: z.number().min(0)
    })).min(1),
    applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).default("ALL"),
    applicableIds: z.array(z.number().int()).nullable().default(null),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    priority: z.number().int().default(0),
    stackable: z.boolean().default(false),
    description: z.string().max(512).default("")
  }).parse(req.body);

  const result = await fullReductionService.createFullReduction(body, req.tenantId!);
  res.json(ok(result));
});

export const listFullReductions = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;

  const result = await fullReductionService.listFullReductions(page, pageSize, req.tenantId!, status);
  res.json(ok(result));
});

export const getFullReduction = asyncHandler(async (req, res) => {
  const result = await fullReductionService.getFullReduction(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateFullReduction = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    rules: z.array(z.object({
      minAmount: z.number().min(0),
      reduceAmount: z.number().min(0)
    })).min(1).optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).optional(),
    applicableIds: z.array(z.number().int()).nullable().optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
    priority: z.number().int().optional(),
    stackable: z.boolean().optional(),
    description: z.string().max(512).optional()
  }).parse(req.body);

  const result = await fullReductionService.updateFullReduction(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteFullReduction = asyncHandler(async (req, res) => {
  const result = await fullReductionService.deleteFullReduction(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const activateFullReduction = asyncHandler(async (req, res) => {
  const result = await fullReductionService.activateFullReduction(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const pauseFullReduction = asyncHandler(async (req, res) => {
  const result = await fullReductionService.pauseFullReduction(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});
