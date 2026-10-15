import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as reconciliationController from "../controllers/admin/reconciliation.controller";

export const reconciliationRouter = Router();
reconciliationRouter.get("/customer", reconciliationController.getCustomerReconciliation);
reconciliationRouter.get("/customer/:customerId", reconciliationController.getCustomerReconciliationDetail);
// ⚠️ S3-223（财务域接线 · B2 批 5）：本文件 2 个写端点（客户/供应商对账确认）**本批均不接**。
// 二者已被 `rbac-g1-wiring.test.ts:276-277` 与 `rbac-g2-wiring.test.ts:268-290` 锁为「B 类待裁」：
// app-mobile 对账页（`pages-sub/finance/reconciliation/reconciliation.vue:256/258`）注册码
// `finance:reconciliation` **无对应 t_sys_menu 行**，且「我的」页快捷入口为无条件（`profile.vue:177-181`）
// ⇒ 可达角色集不可枚举，硬接会把看得到该按钮的角色打成 403（同批 1 `trace:*` 形态）。
reconciliationRouter.post("/customer/:customerId/confirm", reconciliationController.confirmCustomerReconciliation);
reconciliationRouter.get("/supplier", reconciliationController.getSupplierReconciliation);
reconciliationRouter.get("/supplier/:supplierId", reconciliationController.getSupplierReconciliationDetail);
reconciliationRouter.post("/supplier/:supplierId/confirm", reconciliationController.confirmSupplierReconciliation);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reconciliation",
  router: reconciliationRouter,
  auth: "requireAuthWithTenant",
};
