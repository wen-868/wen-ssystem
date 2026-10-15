import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as commissionController from "../controllers/admin/commission.controller";

export const commissionRouter = Router();

// 规则 CRUD
commissionRouter.get("/rules", commissionController.listCommissionRules);
commissionRouter.post("/rules", requirePermission("sale:commission"), commissionController.createCommissionRule);
// S3-223（财务域接线 · B2 批 5）：改/删提成规则挂本文件 S3-126 既有码 `sale:commission`
//（同族、同使用者）。持有者 = 超管/运营（`*`）+ 店长（`sale:*`）；
// 域内页面 `admin-web/src/router/index.ts:112` `sales/commission/rules` 门禁 [SUPER_ADMIN, STORE_MANAGER]，
// 调用点 `views/sale/CommissionRules.vue:208 / :226` ⇒ 页面角色 ⊆ 持有人，零回归。
commissionRouter.put("/rules/:id", requirePermission("sale:commission"), commissionController.updateCommissionRule);
commissionRouter.delete("/rules/:id", requirePermission("sale:commission"), commissionController.deleteCommissionRule);

// 计算引擎
// ⚠️ S3-223 **本行不接**：`POST /api/admin/commission/calculate` 落在 `rbac-g0-wiring.test.ts:705` 的
// 「范围控制」名单（断言 READONLY 仍 200）⇒ 属 G0 锁定项，接线必改该断言，本批未获授权（见回执 §三）。
commissionRouter.post("/calculate", commissionController.calculateCommissions);
commissionRouter.post("/settle", requirePermission("finance:payment"), commissionController.settleCommissions);
commissionRouter.get("/records", commissionController.listCommissionRecords);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/commission",
  router: commissionRouter,
  auth: "requireAuthWithTenant",
};
