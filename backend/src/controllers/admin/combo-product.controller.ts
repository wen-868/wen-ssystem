import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as comboProductService from "../../services/admin/combo-product.service";

// 组合品列表
export const listComboProducts = asyncHandler(async (req, res) => {
  const result = await comboProductService.listComboProducts({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    keyword: req.query.keyword as string | undefined,
    status: req.query.status !== undefined ? Number(req.query.status) : undefined,
    comboType: req.query.comboType as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 组合品详情
export const getComboProductDetail = asyncHandler(async (req, res) => {
  const result = await comboProductService.getComboProductDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 创建组合品
export const createComboProduct = asyncHandler(async (req, res) => {
  const result = await comboProductService.createComboProduct({
    comboName: req.body.comboName,
    comboType: req.body.comboType || "FIXED",
    categoryId: req.body.categoryId,
    coverImage: req.body.coverImage,
    description: req.body.description,
    basePrice: Number(req.body.basePrice || 0),
    status: req.body.status,
    sortOrder: req.body.sortOrder,
    options: req.body.options || [],
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 更新组合品
export const updateComboProduct = asyncHandler(async (req, res) => {
  const result = await comboProductService.updateComboProduct(
    Number(req.params.id),
    {
      comboName: req.body.comboName,
      comboType: req.body.comboType,
      categoryId: req.body.categoryId,
      coverImage: req.body.coverImage,
      description: req.body.description,
      basePrice: req.body.basePrice !== undefined ? Number(req.body.basePrice) : undefined,
      status: req.body.status,
      sortOrder: req.body.sortOrder,
      options: req.body.options,
      tenantId: req.tenantId!,
    }
  );
  res.json(ok(result));
});

// 删除组合品
export const deleteComboProduct = asyncHandler(async (req, res) => {
  const result = await comboProductService.deleteComboProduct(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});
