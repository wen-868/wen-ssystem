import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as reconciliationController from "../controllers/admin/reconciliation.controller";

export const reconciliationRouter = Router();
reconciliationRouter.get("/customer", reconciliationController.getCustomerReconciliation);
reconciliationRouter.get("/customer/:customerId", reconciliationController.getCustomerReconciliationDetail);
// S3-233（B 类收编第一批 · 财务域）：客户/供应商对账确认挂 `report:finance`。
// 依据门 = permission-gates.ts 的 `fin-recon-confirm`（对账页「确认对账」按钮）；同域同语义先例 =
// S3-214-B2 的对账单 confirm / dispute（`report:finance`，pageRoles 含店长，店长持 `report:*` ⇒ 在用角色不减）。
// B 类前提（对账页经「我的」页无条件快捷入口可达，`profile.vue:177-181`）已由 S3-230 的入口权限门修复。
reconciliationRouter.post("/customer/:customerId/confirm", requirePermission("report:finance"), reconciliationController.confirmCustomerReconciliation);
reconciliationRouter.get("/supplier", reconciliationController.getSupplierReconciliation);
reconciliationRouter.get("/supplier/:supplierId", reconciliationController.getSupplierReconciliationDetail);
reconciliationRouter.post("/supplier/:supplierId/confirm", requirePermission("report:finance"), reconciliationController.confirmSupplierReconciliation);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reconciliation",
  router: reconciliationRouter,
  auth: "requireAuthWithTenant",
};
