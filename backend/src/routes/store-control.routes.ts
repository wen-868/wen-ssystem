import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/admin/store-control.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { startStoreControlScheduler } from "../shared/store-control-scheduler";

startStoreControlScheduler();

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

export const storeStoreControlRouter = Router();

storeStoreControlRouter.get("/status", ctrl.getStoreStatus);
storeStoreControlRouter.get("/my-logs", ctrl.listMyLogs);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/store-control", router: adminStoreControlRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/control", router: storeStoreControlRouter, auth: "requireAuthWithTenant" },
];
