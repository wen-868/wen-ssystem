import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-limited-discount.service.js";

export const createLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.createLimitedDiscount(req.body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listLimitedDiscounts = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as any;
  const result = await svc.listLimitedDiscounts({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getLimitedDiscountDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getLimitedDiscountDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateLimitedDiscount = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.updateLimitedDiscount(Number(req.params.id), req.body, req.tenantId!);
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
  await svc.addDiscountProduct(Number(req.params.id), req.body, req.tenantId!);
  res.json(ok(null));
});

export const removeDiscountProduct = asyncHandler(async (req: Request, res: Response) => {
  await svc.removeDiscountProduct(Number(req.params.id), Number(req.params.productId), req.tenantId!);
  res.json(ok(null));
});