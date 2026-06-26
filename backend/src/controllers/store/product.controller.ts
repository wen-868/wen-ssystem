import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as productService from "../../services/store/product.service.js";

export const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts({
    keyword: String(req.query.keyword || ""),
    barcode: String(req.query.barcode || ""),
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