import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/miniapp-config.controller";

export const miniappConfigRouter = Router();

miniappConfigRouter.get("/configs", ctrl.listConfigs);
miniappConfigRouter.get("/configs/:platform", ctrl.getConfig);
miniappConfigRouter.put("/configs/:platform", ctrl.saveConfig);
miniappConfigRouter.get("/templates", ctrl.listTemplates);
miniappConfigRouter.get("/templates/:id", ctrl.getTemplate);
miniappConfigRouter.post("/publish", ctrl.publish);
miniappConfigRouter.get("/publish-logs", ctrl.listPublishLogs);

export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp-config",
  router: miniappConfigRouter,
  auth: "requireAuthWithTenant",
};
