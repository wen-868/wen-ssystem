import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as ctrl from "../controllers/customer-merge.controller.js";

export const customerMergeRouter = Router();
customerMergeRouter.get("/duplicates", requireAuthWithTenant, ctrl.detectDuplicates);
customerMergeRouter.get("/duplicate-groups", requireAuthWithTenant, ctrl.getDuplicateGroups);
customerMergeRouter.get("/:customerId/relations", requireAuthWithTenant, ctrl.getCustomerRelations);
customerMergeRouter.post("/merge", requireAuthWithTenant, ctrl.mergeCustomers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-merge",
  router: customerMergeRouter,
  auth: "requireAuthWithTenant",
};
