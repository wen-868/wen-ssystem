import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as careController from "../controllers/admin/customer-care.controller.js";

export const customerCareRouter = Router();
customerCareRouter.get("/rules", requireAuthWithTenant, careController.listCareRules);
customerCareRouter.post("/rules", requireAuthWithTenant, careController.createCareRule);
customerCareRouter.put("/rules/:id", requireAuthWithTenant, careController.updateCareRule);
customerCareRouter.delete("/rules/:id", requireAuthWithTenant, careController.deleteCareRule);
customerCareRouter.get("/logs", requireAuthWithTenant, careController.listCareLogs);
customerCareRouter.post("/rules/:id/execute", requireAuthWithTenant, careController.executeCareRule);