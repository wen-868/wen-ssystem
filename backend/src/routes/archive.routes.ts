import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as archiveController from "../controllers/admin/archive.controller";

export const archiveRouter = Router();

archiveRouter.post("/execute", requireAuthWithTenant, archiveController.executeArchive);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/archive",
  router: archiveRouter
};