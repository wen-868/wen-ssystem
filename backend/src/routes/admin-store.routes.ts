import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as employeeController from "../controllers/admin/employee.controller";

export const adminStoreRouter = Router();

// ============ 门店管理 ============
adminStoreRouter.get("/stores", requireAuthWithTenant, employeeController.listStores);
adminStoreRouter.post("/stores", requireAuthWithTenant, employeeController.createStore);
adminStoreRouter.get("/stores/:id", requireAuthWithTenant, employeeController.getStore);
adminStoreRouter.put("/stores/:id", requireAuthWithTenant, employeeController.updateStore);
adminStoreRouter.get("/stores/:id/wechat-info", requireAuthWithTenant, employeeController.getStoreWechatInfo);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminStoreRouter,
  auth: "requireAuthWithTenant",
};