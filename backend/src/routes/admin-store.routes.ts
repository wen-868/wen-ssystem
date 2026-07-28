import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as employeeController from "../controllers/admin/employee.controller";

export const adminStoreRouter = Router();

// ============ 门店管理 ============
adminStoreRouter.get("/stores", employeeController.listStores);
adminStoreRouter.post("/stores", employeeController.createStore);
adminStoreRouter.get("/stores/:id", employeeController.getStore);
adminStoreRouter.put("/stores/:id", employeeController.updateStore);
adminStoreRouter.get("/stores/:id/wechat-info", employeeController.getStoreWechatInfo);

// ========== 路由自动发现配置 ==========
// 前端 admin-web 通过 /api/admin/system/* 命名空间访问门店管理 API
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/system",
  router: adminStoreRouter,
  auth: "requireAuthWithTenant",
};