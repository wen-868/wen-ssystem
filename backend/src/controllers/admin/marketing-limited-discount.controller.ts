import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-limited-discount.service.js";

const createLimitedDiscountSchema = z.object({
  name: z.string().min(1).max(200),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  limitPerUser: z.number().int().positive().optional(),
  totalLimit: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
  description: z.string().max(2000).optional(),
  applicableScope: z.enum(["ALL", "SPECIFIC"]).default("ALL"),
});

const updateLimitedDiscountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().positive().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limitPerUser: z.number().int().positive().optional(),
  totalLimit: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  description: z.string().max(2000).optional(),
  applicableScope: z.enum(["ALL", "SPECIFIC"]).optional(),
});

const addDiscountProductSchema = z.object({
  skuIds: z.array(z.number().int().positive()).min(1),
});

export const createLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  const body = createLimitedDiscountSchema.parse(req.body);
  const result = await svc.createLimitedDiscount(body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listLimitedDiscounts = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as Record<string, string | undefined>;
  const result = await svc.listLimitedDiscounts({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getLimitedDiscountDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getLimitedDiscountDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  const body = updateLimitedDiscountSchema.parse(req.body);
  const result = await svc.updateLimitedDiscount(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteLimitedDiscount(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const activateLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  await svc.activateLimitedDiscount(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const pauseLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  await svc.pauseLimitedDiscount(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const getDiscountProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getDiscountProducts(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const addDiscountProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = addDiscountProductSchema.parse(req.body);
  await svc.addDiscountProduct(Number(req.params.id), body, req.tenantId!);
  res.json(ok(null));
});

export const removeDiscountProduct = asyncHandler(async (req: Request, res: Response) => {
  await svc.removeDiscountProduct(Number(req.params.id), Number(req.params.productId), req.tenantId!);
  res.json(ok(null));
});