import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-points-mall.service.js";

export const createPointsProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.createPointsProduct(req.body, req.tenantId!);
  res.json(ok(result));
});

export const listPointsProducts = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as any;
  const result = await svc.listPointsProducts({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getPointsProductDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getPointsProductDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updatePointsProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.updatePointsProduct(Number(req.params.id), req.body, req.tenantId!);
  res.json(ok(result));
});

export const deletePointsProduct = asyncHandler(async (req: Request, res: Response) => {
  await svc.deletePointsProduct(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const togglePointsProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.togglePointsProduct(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const listExchangeRecords = asyncHandler(async (req: Request, res: Response) => {
  const { userId, status, page, pageSize } = req.query as any;
  const result = await svc.listExchangeRecords({ tenantId: req.tenantId!, userId: userId ? Number(userId) : undefined, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getExchangeRecordDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getExchangeRecordDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const exchangeProduct = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.exchangeProduct(req.body, req.tenantId!);
  res.json(ok(result));
});

export const cancelExchange = asyncHandler(async (req: Request, res: Response) => {
  await svc.cancelExchange(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const confirmExchange = asyncHandler(async (req: Request, res: Response) => {
  await svc.confirmExchange(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});