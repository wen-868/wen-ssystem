import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/miniapp-config.controller.js";

export const miniappConfigRouter = Router();

miniappConfigRouter.get("/configs", requireAuthWithTenant, ctrl.listConfigs);
miniappConfigRouter.get("/configs/:platform", requireAuthWithTenant, ctrl.getConfig);
miniappConfigRouter.put("/configs/:platform", requireAuthWithTenant, ctrl.saveConfig);
miniappConfigRouter.get("/templates", requireAuthWithTenant, ctrl.listTemplates);
miniappConfigRouter.get("/templates/:id", requireAuthWithTenant, ctrl.getTemplate);
miniappConfigRouter.post("/publish", requireAuthWithTenant, ctrl.publish);
miniappConfigRouter.get("/publish-logs", requireAuthWithTenant, ctrl.listPublishLogs);