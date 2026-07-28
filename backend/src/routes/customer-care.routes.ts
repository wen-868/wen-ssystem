import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as careController from "../controllers/admin/customer-care.controller";

export const customerCareRouter = Router();
customerCareRouter.get("/rules", careController.listCareRules);
customerCareRouter.post("/rules", careController.createCareRule);
customerCareRouter.put("/rules/:id", careController.updateCareRule);
customerCareRouter.delete("/rules/:id", careController.deleteCareRule);
customerCareRouter.get("/logs", careController.listCareLogs);
customerCareRouter.post("/rules/:id/execute", careController.executeCareRule);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/care",
  router: customerCareRouter,
  auth: "requireAuthWithTenant",
};
