import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/sys-config.controller.js";

export const sysConfigRouter = Router();

sysConfigRouter.get("/", requireAuthWithTenant, ctrl.getAllConfigs);
sysConfigRouter.get("/:group", requireAuthWithTenant, ctrl.getConfigByGroup);
sysConfigRouter.put("/batch", requireAuthWithTenant, ctrl.batchUpdateConfigs);
sysConfigRouter.post("/", requireAuthWithTenant, ctrl.createConfig);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sys-config",
  router: sysConfigRouter,
  auth: "requireAuthWithTenant",
};
