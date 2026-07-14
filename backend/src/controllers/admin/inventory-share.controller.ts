import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as inventoryShareService from "../../services/admin/inventory-share.service";

// ========== 库存共享设置 ==========

// 获取库存共享设置
export const getShareSetting = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.getShareSetting(req.tenantId!);
  res.json(ok(result));
});

// 更新库存共享设置
export const updateShareSetting = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.updateShareSetting(req.tenantId!, {
    shareEnabled: req.body.shareEnabled !== undefined ? Boolean(req.body.shareEnabled) : undefined,
    autoTransfer: req.body.autoTransfer !== undefined ? Boolean(req.body.autoTransfer) : undefined,
    autoTransferThreshold: req.body.autoTransferThreshold !== undefined ? Number(req.body.autoTransferThreshold) : undefined,
    shareScope: req.body.shareScope,
    specifiedStoreIds: req.body.specifiedStoreIds,
  });
  res.json(ok(result));
});

// ========== 共享商品 ==========

// 共享商品列表
export const listShareProducts = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.listShareProducts({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    status: req.query.status !== undefined ? Number(req.query.status) : undefined,
    categoryId: req.query.categoryId !== undefined ? Number(req.query.categoryId) : undefined,
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 添加共享商品
export const addShareProduct = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.addShareProduct(req.tenantId!, {
    spuId: Number(req.body.spuId),
    spuName: req.body.spuName,
    skuId: req.body.skuId !== undefined ? Number(req.body.skuId) : undefined,
    skuName: req.body.skuName,
    barcode: req.body.barcode,
    shareQty: req.body.shareQty !== undefined ? Number(req.body.shareQty) : undefined,
    minKeepQty: req.body.minKeepQty !== undefined ? Number(req.body.minKeepQty) : undefined,
  });
  res.json(ok(result));
});

// 批量添加共享商品
export const batchAddShareProducts = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.batchAddShareProducts(
    req.tenantId!,
    req.body.products || []
  );
  res.json(ok(result));
});

// 更新共享商品
export const updateShareProduct = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.updateShareProduct(
    Number(req.params.id),
    req.tenantId!,
    {
      shareQty: req.body.shareQty !== undefined ? Number(req.body.shareQty) : undefined,
      minKeepQty: req.body.minKeepQty !== undefined ? Number(req.body.minKeepQty) : undefined,
      status: req.body.status !== undefined ? Number(req.body.status) : undefined,
    }
  );
  res.json(ok(result));
});

// 移除共享商品
export const removeShareProduct = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.removeShareProduct(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 批量移除共享商品
export const batchRemoveShareProducts = asyncHandler(async (req, res) => {
  const result = await inventoryShareService.batchRemoveShareProducts(
    req.body.ids || [],
    req.tenantId!
  );
  res.json(ok(result));
});
