import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/sys-config.controller";

export const sysConfigRouter = Router();

sysConfigRouter.get("/backups", ctrl.listBackups);
sysConfigRouter.get("/backups/:name/download", ctrl.downloadBackup);
sysConfigRouter.delete("/backups/:name", ctrl.deleteBackup);
sysConfigRouter.get("/tenant-info", ctrl.getTenantInfo);
sysConfigRouter.get("/", ctrl.getAllConfigs);
sysConfigRouter.get("/:group", ctrl.getConfigByGroup);
sysConfigRouter.put("/batch", ctrl.batchUpdateConfigs);
sysConfigRouter.post("/", ctrl.createConfig);
sysConfigRouter.post("/test-mail", ctrl.testMail);
sysConfigRouter.post("/manual-backup", ctrl.manualBackup);
// ========== ·���Զ��������� ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sys-config",
  router: sysConfigRouter,
  auth: "requireAuthWithTenant",
};
