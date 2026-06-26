import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/instant-retail.controller.js";

export const instantRetailRouter = Router();

// ========== 店铺配置管理 ==========

// 获取店铺配置
instantRetailRouter.get("/shop-config", requireAuthWithTenant, ctrl.getShopConfig);

// 创建/更新店铺配置
instantRetailRouter.post("/shop-config", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    shopName: z.string().min(1).max(128),
    shopLogo: z.string().max(255).optional(),
    shopDescription: z.string().max(500).optional(),
    contactPhone: z.string().max(20).optional(),
    businessHours: z.string().max(100).optional(),
    deliveryEnabled: z.number().int().min(0).max(1).default(1),
    pickupEnabled: z.number().int().min(0).max(1).default(1),
    minOrderAmount: z.number().min(0).default(0),
    deliveryFee: z.number().min(0).default(0),
    freeDeliveryAmount: z.number().min(0).optional(),
    deliveryRadius: z.number().int().min(0).optional(),
    estimatedDeliveryTime: z.string().max(50).optional(),
    announcement: z.string().optional(),
  }).parse(req.body);
  req.body = body;
  await ctrl.saveShopConfig(req, res, _next);
}));

// ========== 分类管理 ==========

// 获取分类列表
instantRetailRouter.get("/categories", requireAuthWithTenant, ctrl.listCategories);

// 创建分类
instantRetailRouter.post("/categories", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    categoryName: z.string().min(1).max(64),
    categoryIcon: z.string().max(255).optional(),
    parentId: z.number().int().default(0),
    sortOrder: z.number().int().default(0),
  }).parse(req.body);
  req.body = body;
  await ctrl.createCategory(req, res, _next);
}));

// ========== 商品管理 ==========

// 获取即时零售商品列表
instantRetailRouter.get("/products", requireAuthWithTenant, ctrl.listProducts);

// 添加商品到即时零售
instantRetailRouter.post("/products", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    productId: z.number().int().positive(),
    categoryId: z.number().int().optional(),
    retailPrice: z.number().min(0),
    originalPrice: z.number().min(0).optional(),
    stock: z.number().int().min(0).default(0),
    isRecommended: z.number().int().min(0).max(1).default(0),
    isHot: z.number().int().min(0).max(1).default(0),
    isNew: z.number().int().min(0).max(1).default(0),
    sortOrder: z.number().int().default(0),
  }).parse(req.body);
  req.body = body;
  await ctrl.addProduct(req, res, _next);
}));

// ========== 订单管理 ==========

// 获取即时零售订单列表
instantRetailRouter.get("/orders", requireAuthWithTenant, ctrl.listOrders);

// 获取订单详情
instantRetailRouter.get("/orders/:orderNo", requireAuthWithTenant, ctrl.getOrderDetail);

// 更新订单状态
instantRetailRouter.put("/orders/:orderNo/status", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"]),
    cancelReason: z.string().max(255).optional(),
  }).parse(req.body);
  req.body = body;
  await ctrl.updateOrderStatus(req, res, _next);
}));

// ========== 轮播图管理 ==========

// 获取轮播图列表
instantRetailRouter.get("/banners", requireAuthWithTenant, ctrl.listBanners);

// 创建轮播图
instantRetailRouter.post("/banners", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    bannerTitle: z.string().min(1).max(128),
    bannerImage: z.string().min(1).max(255),
    linkType: z.enum(["PRODUCT", "CATEGORY", "URL"]).optional(),
    linkValue: z.string().max(255).optional(),
    sortOrder: z.number().int().default(0),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  }).parse(req.body);
  req.body = body;
  await ctrl.createBanner(req, res, _next);
}));