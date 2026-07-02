import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/store-control.controller.js";

// ==================== 管理端路由器（admin） ====================

export const adminStoreControlRouter = Router();

adminStoreControlRouter.use(requireAuthWithTenant);

adminStoreControlRouter.get("/configs", ctrl.listConfigs);
adminStoreControlRouter.get("/configs/:storeId", ctrl.getConfig);
adminStoreControlRouter.put("/configs/:storeId", ctrl.updateConfig);
adminStoreControlRouter.post("/:storeId/open", ctrl.openStore);
adminStoreControlRouter.post("/:storeId/close", ctrl.closeStore);
adminStoreControlRouter.post("/:storeId/suspend", ctrl.suspendStore);
adminStoreControlRouter.post("/:storeId/resume", ctrl.resumeStore);
adminStoreControlRouter.get("/logs", ctrl.listStatusLogs);

// ==================== 门店终端侧路由器（store，只读接口） ====================

export const storeStoreControlRouter = Router();

storeStoreControlRouter.get("/status", ctrl.getStoreStatus);
storeStoreControlRouter.get("/my-logs", ctrl.listMyLogs);