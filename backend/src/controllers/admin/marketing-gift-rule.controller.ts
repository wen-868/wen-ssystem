import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/marketing-gift-rule.service";

const createGiftRuleSchema = z.object({
  name: z.string().min(1).max(200),
  triggerType: z.enum(["AMOUNT", "QUANTITY"]),
  triggerValue: z.number().positive(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
  description: z.string().max(2000).optional(),
  applicableScope: z.enum(["ALL", "SPECIFIC"]).default("ALL"),
  levels: z.array(z.object({
    name: z.string().min(1).max(100),
    giftSkuId: z.number().int().positive(),
    giftQuantity: z.number().int().positive(),
    sortNo: z.number().int().default(0),
  })).min(1).optional(),
});

const updateGiftRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerType: z.enum(["AMOUNT", "QUANTITY"]).optional(),
  triggerValue: z.number().positive().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  description: z.string().max(2000).optional(),
  applicableScope: z.enum(["ALL", "SPECIFIC"]).optional(),
});

const giftRuleLevelSchema = z.object({
  name: z.string().min(1).max(100),
  giftSkuId: z.number().int().positive(),
  giftQuantity: z.number().int().positive(),
  sortNo: z.number().int().default(0),
});

export const createGiftRule = asyncHandler(async (req: Request, res: Response) => {
  const body = createGiftRuleSchema.parse(req.body);
  const result = await svc.createGiftRule(body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listGiftRules = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as Record<string, string | undefined>;
  const result = await svc.listGiftRules({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getGiftRuleDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getGiftRuleDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateGiftRule = asyncHandler(async (req: Request, res: Response) => {
  const body = updateGiftRuleSchema.parse(req.body);
  const result = await svc.updateGiftRule(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteGiftRule = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteGiftRule(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const activateGiftRule = asyncHandler(async (req: Request, res: Response) => {
  await svc.activateGiftRule(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const pauseGiftRule = asyncHandler(async (req: Request, res: Response) => {
  await svc.pauseGiftRule(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const addGiftRuleLevel = asyncHandler(async (req: Request, res: Response) => {
  const body = giftRuleLevelSchema.parse(req.body);
  await svc.addGiftRuleLevel(Number(req.params.id), body, req.tenantId!);
  res.json(ok(null));
});

export const updateGiftRuleLevel = asyncHandler(async (req: Request, res: Response) => {
  const body = giftRuleLevelSchema.partial().parse(req.body);
  await svc.updateGiftRuleLevel(Number(req.params.id), Number(req.params.levelId), body, req.tenantId!);
  res.json(ok(null));
});

export const deleteGiftRuleLevel = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteGiftRuleLevel(Number(req.params.id), Number(req.params.levelId), req.tenantId!);
  res.json(ok(null));
});