import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：合并动作无页面调用方（仅 API 策略面），落地码取台账 §三.2 建议码。
import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/admin/customer-merge.controller";

export const customerMergeRouter = Router();
customerMergeRouter.get("/duplicates", ctrl.detectDuplicates);
customerMergeRouter.get("/duplicate-groups", ctrl.getDuplicateGroups);
customerMergeRouter.get("/:customerId/relations", ctrl.getCustomerRelations);
customerMergeRouter.post("/merge", requirePermission("customer:create"), ctrl.mergeCustomers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-merge",
  router: customerMergeRouter,
  auth: "requireAuthWithTenant",
};
