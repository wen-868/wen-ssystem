import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as archiveController from "../controllers/admin/archive.controller";

export const archiveRouter = Router();

archiveRouter.post("/execute", archiveController.executeArchive);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/archive",
  router: archiveRouter
};