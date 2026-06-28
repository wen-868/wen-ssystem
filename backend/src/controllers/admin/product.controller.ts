import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import { z } from "zod";
import * as productService from "../../services/admin/product.service.js";
import { cacheDelPattern } from "../../shared/redis-cache.js";

export const listProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = String(req.query.keyword || "");
  const category = req.query.category ? String(req.query.category) : undefined;
  const result = await productService.listProducts(keyword, page, pageSize, tenantId, category);
  res.json(ok(result));
});

export const createProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rawBody = req.body;
  const body = z.object({
    name: z.string(),
    categoryId: z.number(),
    mainImage: z.string().optional(),
    saleChannels: z.array(z.string()).default(["MINIAPP", "STORE"]),
    skus: z.array(z.object({
      skuName: z.string(),
      barcode: z.string().optional(),
      boxRatio: z.number().default(1),
      temperature: z.enum(["NORMAL", "CHILLED"]).default("NORMAL"),
      traceEnabled: z.boolean().default(false),
      warningThreshold: z.number().default(0),
      costPrice: z.number().default(0),
      retailPrice: z.number(),
      wholesalePrice: z.number().nullable().optional(),
      miniappPrice: z.number().nullable().optional(),
      storePrice: z.number().nullable().optional()
    })).min(1)
  }).parse({
    ...rawBody,
    skus: rawBody.skus ?? [{
      skuName: rawBody.skuName,
      barcode: rawBody.barcode,
      retailPrice: rawBody.retailPrice,
      wholesalePrice: rawBody.wholesalePrice,
      miniappPrice: rawBody.miniappPrice,
      storePrice: rawBody.storePrice,
      warningThreshold: rawBody.warningThreshold ?? 0
    }]
  });
  const result = await productService.createProduct(body, tenantId, rawBody);
  res.json(ok(result));
});

export const updateProductStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({ status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]) }).parse(req.body);
  const result = await productService.updateProductStatus(Number(req.params.spuId), body.status, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }
  res.json(ok(result));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.spuId);
  const body = z.object({
    name: z.string().optional(),
    barcode: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    unit: z.string().optional(),
    boxRatio: z.number().optional(),
    specs: z.string().optional(),
    status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).optional()
  }).parse(req.body);
  const result = await productService.updateProduct(spuId, body, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }
  res.json(ok(result));
});

export const disableProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.spuId);
  const result = await productService.disableProduct(spuId, tenantId);
  if (result.code) {
    res.status(Number(result.code)).json({ code: result.code, message: result.message });
    return;
  }
  res.json(ok(result));
});

export const getProductPriceHistory = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await productService.getProductPriceHistory(Number(req.params.skuId), tenantId);
  res.json(ok(result));
});

export const updateProductPrice = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const skuId = Number(req.params.skuId);
  const body = z.object({
    costPrice: z.number().optional(),
    retailPrice: z.number().optional(),
    wholesalePrice: z.number().nullable().optional(),
    miniappPrice: z.number().nullable().optional(),
    storePrice: z.number().nullable().optional()
  }).parse(req.body);
  try {
    const result = await productService.updateProductPrice(skuId, body, tenantId, req.user!.id ?? 0);
    res.json(ok(result));
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({ code: "404", message: err.message });
      return;
    }
    throw err;
  }
});

/** 批量更新商品 */
export const batchUpdateProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const body = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    updates: z.object({
      status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).optional(),
      costPrice: z.number().optional(),
      retailPrice: z.number().optional(),
      wholesalePrice: z.number().nullable().optional(),
      miniappPrice: z.number().nullable().optional(),
      storePrice: z.number().nullable().optional(),
      categoryId: z.number().optional(),
    }),
  }).parse(req.body);

  const results = await productService.batchUpdateProducts(body.ids, body.updates, tenantId);

  // 清除商品缓存
  await cacheDelPattern(`tenant:${tenantId}:product:*`);
  await cacheDelPattern(`tenant:${tenantId}:products:*`);

  res.json(ok({
    total: body.ids.length,
    success: results.success,
    failed: results.failed,
    details: results.details,
  }));
});