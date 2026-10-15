import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 = 台账 §三.2 建议码（POST ⇒ customer:create，PUT/DELETE ⇒ customer:edit）。
import { requirePermission } from "../middleware/rbac-auth";

import * as careController from "../controllers/admin/customer-care.controller";

export const customerCareRouter = Router();
customerCareRouter.get("/rules", careController.listCareRules);
customerCareRouter.post("/rules", requirePermission("customer:create"), careController.createCareRule);
customerCareRouter.put("/rules/:id", requirePermission("customer:edit"), careController.updateCareRule);
customerCareRouter.delete("/rules/:id", requirePermission("customer:edit"), careController.deleteCareRule);
customerCareRouter.get("/logs", careController.listCareLogs);
customerCareRouter.post("/rules/:id/execute", requirePermission("customer:create"), careController.executeCareRule);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/care",
  router: customerCareRouter,
  auth: "requireAuthWithTenant",
};
