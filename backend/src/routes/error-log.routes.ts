import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/error-log.controller.js";

export const errorLogRouter = Router();

errorLogRouter.post("/error-report", requireAuthWithTenant, ctrl.reportFrontendError);
errorLogRouter.get("/error-logs", requireAuthWithTenant, ctrl.listErrorLogs);
