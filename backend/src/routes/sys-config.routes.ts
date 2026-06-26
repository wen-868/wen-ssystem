import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/sys-config.controller.js";

export const sysConfigRouter = Router();

sysConfigRouter.get("/", requireAuthWithTenant, ctrl.getAllConfigs);
sysConfigRouter.get("/:group", requireAuthWithTenant, ctrl.getConfigByGroup);
sysConfigRouter.put("/batch", requireAuthWithTenant, ctrl.batchUpdateConfigs);
sysConfigRouter.post("/", requireAuthWithTenant, ctrl.createConfig);