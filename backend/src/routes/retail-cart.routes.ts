import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as retailExtController from "../controllers/admin/instant-retail-ext.controller";

export const retailCartRouter = Router();

// 购物车分析（E 购物车与结算 - 管理端看板）
retailCartRouter.get("/analysis", retailExtController.getRetailCartAnalysis);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/retail-cart",
  router: retailCartRouter,
  auth: "requireAuthWithTenant",
};
