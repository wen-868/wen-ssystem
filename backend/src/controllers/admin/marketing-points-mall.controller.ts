import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/marketing-points-mall.service";

const createPointsProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
  pointsRequired: z.number().int().positive(),
  stock: z.number().int().min(0),
  limitPerUser: z.number().int().positive().optional(),
  status: z.enum(["ON", "OFF"]).default("ON"),
  sortNo: z.number().int().default(0),
});

const updatePointsProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
  pointsRequired: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  limitPerUser: z.number().int().positive().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
  sortNo: z.number().int().optional(),
});

const exchangeProductSchema = z.object({
  pointsProductId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  addressId: z.number().int().positive().optional(),
  remark: z.string().max(500).optional(),
});

export const createPointsProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = createPointsProductSchema.parse(req.body);
  const result = await svc.createPointsProduct(body, req.tenantId!);
  res.json(ok(result));
});

export const listPointsProducts = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize } = req.query as Record<string, string | undefined>;
  const result = await svc.listPointsProducts({ tenantId: req.tenantId!, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getPointsProductDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getPointsProductDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updatePointsProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = updatePointsProductSchema.parse(req.body);
  const result = await svc.updatePointsProduct(Number(req.params.id), body, req.tenantId!);
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
  const { userId, status, page, pageSize } = req.query as Record<string, string | undefined>;
  const result = await svc.listExchangeRecords({ tenantId: req.tenantId!, userId: userId ? Number(userId) : undefined, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getExchangeRecordDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getExchangeRecordDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const exchangeProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = exchangeProductSchema.parse(req.body);
  const result = await svc.exchangeProduct(body as any, req.tenantId!);
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