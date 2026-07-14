import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as productBundleService from "../../services/admin/product-bundle.service";

// 套装列表
export const listProductBundles = asyncHandler(async (req, res) => {
  const result = await productBundleService.listProductBundles({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    keyword: req.query.keyword as string | undefined,
    status: req.query.status !== undefined ? Number(req.query.status) : undefined,
    categoryId: req.query.categoryId !== undefined ? Number(req.query.categoryId) : undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 套装详情
export const getProductBundleDetail = asyncHandler(async (req, res) => {
  const result = await productBundleService.getProductBundleDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 创建套装
export const createProductBundle = asyncHandler(async (req, res) => {
  const result = await productBundleService.createProductBundle({
    bundleName: req.body.bundleName,
    categoryId: req.body.categoryId,
    coverImage: req.body.coverImage,
    description: req.body.description,
    bundlePrice: Number(req.body.bundlePrice),
    status: req.body.status,
    sortOrder: req.body.sortOrder,
    items: req.body.items || [],
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 更新套装
export const updateProductBundle = asyncHandler(async (req, res) => {
  const result = await productBundleService.updateProductBundle(
    Number(req.params.id),
    {
      bundleName: req.body.bundleName,
      categoryId: req.body.categoryId,
      coverImage: req.body.coverImage,
      description: req.body.description,
      bundlePrice: req.body.bundlePrice !== undefined ? Number(req.body.bundlePrice) : undefined,
      status: req.body.status,
      sortOrder: req.body.sortOrder,
      items: req.body.items,
      tenantId: req.tenantId!,
    }
  );
  res.json(ok(result));
});

// 删除套装
export const deleteProductBundle = asyncHandler(async (req, res) => {
  const result = await productBundleService.deleteProductBundle(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 上架套装
export const publishProductBundle = asyncHandler(async (req, res) => {
  const result = await productBundleService.publishProductBundle(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 下架套装
export const unpublishProductBundle = asyncHandler(async (req, res) => {
  const result = await productBundleService.unpublishProductBundle(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 套装销售统计
export const getProductBundleStats = asyncHandler(async (req, res) => {
  const result = await productBundleService.getProductBundleStats({
    tenantId: req.tenantId!,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
  });
  res.json(ok(result));
});
