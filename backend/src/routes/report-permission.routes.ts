import { Router } from "express";
import { requireAuth } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/report-permission.controller.js";

export const reportPermissionRouter = Router();

reportPermissionRouter.get("/admin/report-permissions/matrix", requireAuth, ctrl.getMatrix);
reportPermissionRouter.put("/admin/report-permissions/matrix", requireAuth, ctrl.saveMatrix);