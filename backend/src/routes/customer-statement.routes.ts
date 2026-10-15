import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：客户对账 = 079:147 既有「客户对账」码 `customer:statement`
//（持有者 = 超管/运营/店长/财务；未照台账机器建议 `customer:create`，见回执 §差异）。
import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/customer-statement.controller";

export const customerStatementRouter = Router();

customerStatementRouter.get("/", ctrl.list);
customerStatementRouter.get("/:statementNo", ctrl.getDetail);
customerStatementRouter.post("/", requirePermission("customer:statement"), ctrl.create);
// ⚠️ S3-222 **本行不接线**：移动端「对账单」页（app-mobile 菜单码 `finance:statement`）可见角色
// = {FINANCE_STAFF, OPERATION_ADMIN, READONLY, STORE_ADMIN}，其中 READONLY(`["*:view"]`) 与
// STORE_ADMIN（099 旧词表）不持任何客户域写码 ⇒ 接线即把「看得到该按钮的角色」打成 403（批 1 `trace:*` 同款形态）。
// 登记「待授权模型定案」（台账 §十二.4），不在本批硬接。
customerStatementRouter.post("/:statementNo/confirm", ctrl.confirm);
customerStatementRouter.post("/:statementNo/paid", requirePermission("customer:statement"), ctrl.markPaid);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-statements",
  router: customerStatementRouter,
  auth: "requireAuthWithTenant",
};
