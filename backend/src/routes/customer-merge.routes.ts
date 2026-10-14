import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/customer-merge.controller";

export const customerMergeRouter = Router();
customerMergeRouter.get("/duplicates", ctrl.detectDuplicates);
customerMergeRouter.get("/duplicate-groups", ctrl.getDuplicateGroups);
customerMergeRouter.get("/:customerId/relations", ctrl.getCustomerRelations);
customerMergeRouter.post("/merge", ctrl.mergeCustomers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-merge",
  router: customerMergeRouter,
  auth: "requireAuthWithTenant",
};
