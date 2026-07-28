import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { apiKeyAuth } from "../middleware/api-key-auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/open/library.controller";

/**
 * Open API — 商品库路由
 *
 * 所有接口使用 API Key 认证（x-api-key 请求头），不走 JWT 认证。
 * auto-routes 自动注册时 auth = "none"，由路由内部 apiKeyAuth 中间件负责鉴权。
 */
export const openLibraryRouter = Router();

// 全局 API Key 认证
openLibraryRouter.use(apiKeyAuth);

// SPU 相关
openLibraryRouter.get("/spus/:id", asyncHandler(controller.getSpuById));
openLibraryRouter.get("/spus/:id/skus", asyncHandler(controller.getSkusBySpuId));

// SKU 按条码查询
openLibraryRouter.get("/sku/barcode/:barcode", asyncHandler(controller.getSkuByBarcode));

// 品牌列表
openLibraryRouter.get("/brands", asyncHandler(controller.getBrands));

export const routeConfig: RouteConfig = {
  prefix: "/api/open/library",
  router: openLibraryRouter,
  auth: "none", // 不走 JWT 认证，路由内部用 apiKeyAuth
};
