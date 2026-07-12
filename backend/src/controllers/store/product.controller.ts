import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as productService from "../../services/store/product.service";

export const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts({
    keyword: String(req.query.keyword || ""),
    barcode: String(req.query.barcode || ""),
    categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    tagIds: req.query.tagIds ? String(req.query.tagIds).split(',').map(Number).filter(Boolean) : undefined,
    storeId: req.user?.storeId ?? 1,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listMembers = asyncHandler(async (req, res) => {
  const result = await productService.listMembers({
    keyword: String(req.query.keyword || ""),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await productService.getCategories(tenantId);
  res.json(ok(result));
});

export const getProductDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await productService.getProductDetail(Number(req.params.spuId), tenantId);
  res.json(ok(result));
});