import { Router } from "express";
import * as ctrl from "../controllers/admin/store-control.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { startStoreControlScheduler } from "../shared/store-control-scheduler";
import { requirePermission } from "../middleware/rbac-auth";

startStoreControlScheduler();

export const adminStoreControlRouter = Router();

adminStoreControlRouter.get("/configs", ctrl.listConfigs);
adminStoreControlRouter.get("/configs/:storeId", ctrl.getConfig);
// S3-229（第 43 项 B2 批 9 · 门店/租户域接线）：本文件管理面 5 条写端点挂 `store:edit`（配置）/ `store:create`（开关店），
// 码位取台账 §三.7「建议权限码」列（既有码，不新立权限点）。
// 依据（逐条可核对）：六端全仓**零页面调用点** —— `rg -F 'store-control'` 在 admin-web / app-mobile /
//   saas-admin / miniapp / website / platform-miniapp 的 `src` 下只命中 `admin-web/src/api/inventory.ts:122-150`
//   的 api 封装行与本文件自身；这 5 个封装函数（`updateStoreControlConfig` / `openStore` / `closeStore` /
//   `suspendStore` / `resumeStore`）在 `.vue` 里**零引用** ⇒ 使用者集合为空，接线不产生 403 风险（S3-226 §15.1 桶②口径）。
//   门店管控页 `admin-web/src/views/pos/StoreControlView.vue`（router:271，roles 含 STORE_MANAGER/STORE_OPERATOR）
//   只调用**读**接口（`fetchStoreControlStatus` / `fetchStoreControlMyLogs`，见该文件 :60/:95/:105）⇒ 不在本 5 条内。
adminStoreControlRouter.put("/configs/:storeId", requirePermission("store:edit"), ctrl.updateConfig);
adminStoreControlRouter.post("/:storeId/open", requirePermission("store:create"), ctrl.openStore);
adminStoreControlRouter.post("/:storeId/close", requirePermission("store:create"), ctrl.closeStore);
adminStoreControlRouter.post("/:storeId/suspend", requirePermission("store:create"), ctrl.suspendStore);
adminStoreControlRouter.post("/:storeId/resume", requirePermission("store:create"), ctrl.resumeStore);
adminStoreControlRouter.get("/logs", ctrl.listStatusLogs);

export const storeStoreControlRouter = Router();

storeStoreControlRouter.get("/status", ctrl.getStoreStatus);
storeStoreControlRouter.get("/my-logs", ctrl.listMyLogs);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/store-control", router: adminStoreControlRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/control", router: storeStoreControlRouter, auth: "requireAuthWithTenant" },
];
