import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-gift-rule.service.js";

export const createGiftRule = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.createGiftRule(req.body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listGiftRules = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as any;
  const result = await svc.listGiftRules({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getGiftRuleDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getGiftRuleDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateGiftRule = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.updateGiftRule(Number(req.params.id), req.body, req.tenantId!);
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
  await svc.addGiftRuleLevel(Number(req.params.id), req.body, req.tenantId!);
  res.json(ok(null));
});

export const updateGiftRuleLevel = asyncHandler(async (req: Request, res: Response) => {
  await svc.updateGiftRuleLevel(Number(req.params.id), Number(req.params.levelId), req.body, req.tenantId!);
  res.json(ok(null));
});

export const deleteGiftRuleLevel = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteGiftRuleLevel(Number(req.params.id), Number(req.params.levelId), req.tenantId!);
  res.json(ok(null));
});