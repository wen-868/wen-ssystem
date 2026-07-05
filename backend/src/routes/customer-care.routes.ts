import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as careController from "../controllers/admin/customer-care.controller.js";

export const customerCareRouter = Router();
customerCareRouter.get("/rules", requireAuthWithTenant, careController.listCareRules);
customerCareRouter.post("/rules", requireAuthWithTenant, careController.createCareRule);
customerCareRouter.put("/rules/:id", requireAuthWithTenant, careController.updateCareRule);
customerCareRouter.delete("/rules/:id", requireAuthWithTenant, careController.deleteCareRule);
customerCareRouter.get("/logs", requireAuthWithTenant, careController.listCareLogs);
customerCareRouter.post("/rules/:id/execute", requireAuthWithTenant, careController.executeCareRule);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/care",
  router: customerCareRouter,
  auth: "requireAuthWithTenant",
};
