import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/library.controller";

/**
 * 商户端商品库扫码查询路由
 *
 * 只提供一个接口：POST /lookup 按条码查询商品库
 */
export const adminLibraryRouter = Router();

// 按条码查询商品库
adminLibraryRouter.post("/lookup", asyncHandler(controller.lookupByBarcode));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/library",
  router: adminLibraryRouter,
  auth: "requireAuthWithTenant",
};
