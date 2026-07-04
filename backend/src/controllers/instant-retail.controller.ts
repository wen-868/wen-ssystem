import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/instant-retail.service.js";

// ────────────────────────────────────────────────────────────────────────────
// 店铺配置管理
// ────────────────────────────────────────────────────────────────────────────

// 1. 获取店铺配置
export const getShopConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.getShopConfig(tenantId);
  res.json(ok(result));
});

// 2. 创建/更新店铺配置
export const saveShopConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.saveShopConfig(req.body, tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 分类管理
// ────────────────────────────────────────────────────────────────────────────

// 3. 获取分类列表
export const listCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listCategories(tenantId);
  res.json(ok(result));
});

// 4. 创建分类
export const createCategory = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.createCategory(req.body, tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 商品管理
// ────────────────────────────────────────────────────────────────────────────

// 5. 获取即时零售商品列表
export const listProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listRetailProducts({
    tenantId,
    categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    status: req.query.status as string | undefined,
    isRecommended: req.query.isRecommended !== undefined ? Number(req.query.isRecommended) : undefined,
    isHot: req.query.isHot !== undefined ? Number(req.query.isHot) : undefined,
    isNew: req.query.isNew !== undefined ? Number(req.query.isNew) : undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  res.json(ok(result));
});

// 6. 添加商品到即时零售
export const addProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.addRetailProduct(req.body, tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 订单管理
// ────────────────────────────────────────────────────────────────────────────

// 7. 订单列表
export const listOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listRetailOrders({
    tenantId,
    orderStatus: req.query.orderStatus as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  res.json(ok(result));
});

// 8. 订单详情 + items
export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.getRetailOrderDetail(req.params.orderNo, tenantId);
  res.json(ok(result));
});

// 9. 更新订单状态
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.updateRetailOrderStatus({
    orderNo: req.params.orderNo,
    tenantId,
    ...req.body
  });
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 轮播图管理
// ────────────────────────────────────────────────────────────────────────────

// 10. 获取轮播图列表
export const listBanners = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listBanners(tenantId);
  res.json(ok(result));
});

// 11. 创建轮播图
export const createBanner = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.createBanner(req.body, tenantId);
  res.json(ok(result));
});