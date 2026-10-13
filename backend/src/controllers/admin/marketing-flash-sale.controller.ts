import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as flashSaleService from "../../services/admin/marketing-flash-sale.service";

export const createFlashSale = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    productId: z.number().int().positive(),
    skuId: z.number().int().positive(),
    flashPrice: z.number().min(0),
    originalPrice: z.number().min(0),
    totalStock: z.number().int().min(0),
    limitPerUser: z.number().int().min(1).default(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1)
  }).parse(req.body);

  const result = await flashSaleService.createFlashSale(body, req.tenantId!);
  res.json(ok(result));
});

export const listFlashSales = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;

  const result = await flashSaleService.listFlashSales(page, pageSize, req.tenantId!, status);
  res.json(ok(result));
});

export const getFlashSale = asyncHandler(async (req, res) => {
  const result = await flashSaleService.getFlashSale(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateFlashSale = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    productId: z.number().int().positive().optional(),
    skuId: z.number().int().positive().optional(),
    flashPrice: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    totalStock: z.number().int().min(0).optional(),
    limitPerUser: z.number().int().min(1).optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional()
  }).parse(req.body);

  const result = await flashSaleService.updateFlashSale(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteFlashSale = asyncHandler(async (req, res) => {
  const result = await flashSaleService.deleteFlashSale(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const activateFlashSale = asyncHandler(async (req, res) => {
  const result = await flashSaleService.activateFlashSale(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const pauseFlashSale = asyncHandler(async (req, res) => {
  const result = await flashSaleService.pauseFlashSale(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const getFlashSaleStatistics = asyncHandler(async (req, res) => {
  const result = await flashSaleService.getFlashSaleStatistics(req.tenantId!);
  res.json(ok(result));
});

export const listActiveFlashSales = asyncHandler(async (req, res) => {
  const result = await flashSaleService.listActiveFlashSales(req.tenantId!);
  res.json(ok(result));
});

export const buyFlashSale = asyncHandler(async (req, res) => {
  // S3-187 A：秒杀活动 id 先校验参数本身合法（路由此前无 :id ⇒ NaN 直落业务层）
  const flashSaleId = Number(req.params.id);
  if (!Number.isInteger(flashSaleId) || flashSaleId <= 0) {
    res.status(400).json(fail("秒杀活动ID无效", "400"));
    return;
  }
  const body = z.object({
    userId: z.number().int().positive(),
    quantity: z.number().int().min(1)
  }).parse(req.body);

  const result = await flashSaleService.buyFlashSale(
    flashSaleId,
    body.userId,
    body.quantity,
    req.tenantId!
  );
  res.json(ok(result));
});
