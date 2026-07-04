import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as productController from "../controllers/store/product.controller.js";

export const storeCustomerRouter = Router();

storeCustomerRouter.use(requireAuthWithTenant);

// 客户
storeCustomerRouter.get("/members", productController.listMembers);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeCustomerRouter,
  auth: "none",
};