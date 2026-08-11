import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as productService from "../../services/admin/product.service";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

/** 从查询参数中提取字符串（无值返回空串） */
function getQueryString(req: any, key: string): string {
  return String(req.query[key] || "");
}

/** 从请求中提取操作人 ID（默认 0） */
function getOperatorId(req: any): number {
  return req.user!.id ?? 0;
}

export const listProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const keyword = getQueryString(req, "keyword");
  const result = await productService.listProducts(keyword, page, pageSize, tenantId);
  res.json(ok(result));
});

export const getProductDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await productService.getProductDetail(Number(req.params.spuId), tenantId);
  res.json(ok(result));
});

export const createProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rawBody = req.body;
  const body = z.object({
    name: z.string(),
    categoryId: z.number(),
    brand: z.string().optional(),
    unit: z.string().optional(),
    specs: z.string().optional(),
    mainImage: z.string().optional(),
    saleChannels: z.array(z.string()).default(["MINIAPP", "STORE"]),
    alcoholContent: z.number().optional(),
    origin: z.string().optional(),
    sortNo: z.number().default(0),
    isNew: z.boolean().default(false),
    isRecommend: z.boolean().default(false),
    description: z.string().optional(),
    skus: z.array(z.object({
      skuName: z.string(),
      barcode: z.string().optional(),
      volume: z.string().optional(),
      packaging: z.string().optional(),
      baseUnit: z.string().optional(),
      boxUnit: z.string().optional(),
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
      volume: rawBody.volume,
      packaging: rawBody.packaging,
      baseUnit: rawBody.baseUnit,
      boxUnit: rawBody.boxUnit,
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
    res.status(404).json(fail("商品不存在", "404"));
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
    status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).optional(),
    sortNo: z.number().optional(),
    isNew: z.boolean().optional(),
    isRecommend: z.boolean().optional(),
    description: z.string().optional()
  }).parse(req.body);
  const result = await productService.updateProduct(spuId, body, tenantId);
  if (!result) {
    res.status(404).json(fail("商品不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const disableProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.spuId);
  const result = await productService.disableProduct(spuId, tenantId);
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
  const result = await productService.updateProductPrice(skuId, body, tenantId, getOperatorId(req));
  res.json(ok(result));
});

export const updateSkuBarcode = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const skuId = Number(req.params.skuId);
  const body = z.object({
    barcode: z.string().max(128).default(""),
  }).parse(req.body);
  const result = await productService.updateSkuBarcode(skuId, body.barcode, tenantId);
  res.json(ok(result));
});

export const importProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rows = req.body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json(fail("请提供有效的导入数据", "400"));
    return;
  }
  const result = await productService.importProducts(rows, tenantId);
  res.json(ok(result));
});

export const setMarketingTags = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    tags: z.array(z.string()),
  }).parse(req.body);
  const result = await productService.setMarketingTags(Number(req.params.spuId), body.tags, tenantId);
  res.json(ok(result));
});
