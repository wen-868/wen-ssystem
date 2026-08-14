import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/marketing-gift-rule.service";

const createGiftRuleSchema = z.object({
  rule_name: z.string().min(1).max(200),
  threshold_type: z.enum(["AMOUNT", "QUANTITY"]),
  threshold_amount: z.number().positive(),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
  rule_desc: z.string().max(2000).optional(),
  applicable_scope: z.enum(["ALL", "SPECIFIC"]).default("ALL"),
  gift_stock_limit: z.number().int().optional(),
  levels: z.array(z.object({
    gift_product_id: z.number().int().positive(),
    gift_sku_id: z.number().int().positive(),
    gift_quantity: z.number().int().positive(),
    sort_order: z.number().int().default(0),
  })).min(1).optional(),
});

const updateGiftRuleSchema = z.object({
  rule_name: z.string().min(1).max(200).optional(),
  threshold_type: z.enum(["AMOUNT", "QUANTITY"]).optional(),
  threshold_amount: z.number().positive().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  rule_desc: z.string().max(2000).optional(),
  applicable_scope: z.enum(["ALL", "SPECIFIC"]).optional(),
  gift_stock_limit: z.number().int().optional(),
});

const giftRuleLevelSchema = z.object({
  gift_product_id: z.number().int().positive(),
  gift_sku_id: z.number().int().positive(),
  gift_quantity: z.number().int().positive(),
  sort_order: z.number().int().default(0),
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