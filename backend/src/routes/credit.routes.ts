import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as creditController from "../controllers/admin/credit.controller";
import * as creditAdjustController from "../controllers/admin/credit-adjust.controller";

export const creditRouter = Router();

// ========================================================================
// 授信额度管理
// ========================================================================
creditRouter.get("/", creditController.getCreditList);

// ========================================================================
// 字面段路由 —— S3-126-F1 顺序修复：**必须注册在 "/:customerId" 参数路由之前**。
//   Express 按注册顺序匹配；单段字面路径（/collections、/risk-*）若排在
//   "/:customerId" 之后，会被当作 customerId 抢先匹配（催收端点因此"根本到不了"）。
// ========================================================================
// 信用评分与风控（赊销风控引擎）
creditRouter.get("/strategy/collection", creditController.getCollectionStrategyConfig);
creditRouter.get("/strategy/tiers", creditController.getCreditTiers);

// 催收管理
creditRouter.get("/collections", creditController.getCollectionList);
// ⚠️ S3-223 **本行不接**：`POST /api/admin/credits/collections` 落在 `rbac-g0-wiring.test.ts:702`
// 的「范围控制」名单（断言 READONLY 仍 200）⇒ G0 锁定项，接线必改该断言，本批未获授权（见回执 §三）。
creditRouter.post("/collections", creditController.createCollection);
// S3-223（财务域接线 · B2 批 5）：催收余下 3 行 + 额度调整 2 行，统一挂**本文件 S3-126 既有码**
// `customer:credit`（同文件 `POST /:customerId` 等 7 行已是此码；不照台账机器建议 `finance:create`——
// 该码持有者不含店长，而额度调整页 `CreditView.vue:279` 的页面角色含店长 ⇒ 会 403 回归，见回执 §四）。
// 催收 3 行全仓**无前端调用点**（`createCollection/updateCollection/batchRemindCollections/auto-generate`
// 在 `admin-web/src/api/customer.ts:145-161` 有导出、零引用）⇒ 零回归。
creditRouter.put("/collections/:id", requirePermission("customer:credit"), creditController.updateCollection);
creditRouter.get("/collections/overdue", creditController.getOverdueCustomers);
creditRouter.post("/collections/auto-generate", requirePermission("customer:credit"), creditController.autoGenerateCollections);
creditRouter.post("/collections/batch-remind", requirePermission("customer:credit"), creditController.batchRemind);
creditRouter.get("/collections/statistics", creditController.getCollectionStatistics);

// 风险客户
creditRouter.get("/risk-customers", creditController.getRiskCustomers);
creditRouter.get("/risk-list", creditController.getRiskCustomers);

// ========================================================================
// 授信额度管理（参数路由）
// ========================================================================
creditRouter.get("/:customerId", creditController.getCreditDetail);
creditRouter.post("/:customerId", requirePermission("customer:credit"), creditController.initCredit);
creditRouter.get("/:customerId/check", creditController.checkCredit);
creditRouter.post("/:customerId/occupy", requirePermission("customer:credit"), creditController.occupyCredit);
creditRouter.post("/:customerId/release", requirePermission("customer:credit"), creditController.releaseCredit);
creditRouter.post("/:customerId/freeze", requirePermission("customer:credit"), creditController.freezeCredit);
creditRouter.post("/:customerId/unfreeze", requirePermission("customer:credit"), creditController.unfreezeCredit);

// 额度调整
// ========================================================================
// 使用者：`views/customer/CreditView.vue:279`（额度调整弹窗 → `api/customer.ts:122`）；
// 页面 `admin-web/src/router/index.ts:163` `credit` 门禁 [SUPER_ADMIN, STORE_MANAGER]。
// 挂 `customer:credit`（持有者 超管/运营 + 店长 `customer:*`）⇒ 页面角色 ⊆ 持有人。
creditRouter.put("/:customerId/limit", requirePermission("customer:credit"), creditAdjustController.adjustLimit);
creditRouter.put("/:customerId/term", requirePermission("customer:credit"), creditAdjustController.adjustTerm);

// ========================================================================
// 信用评分与风控（赊销风控引擎）
// ========================================================================
creditRouter.post("/:customerId/evaluate", requirePermission("customer:credit"), creditController.evaluateCredit);
creditRouter.get("/:customerId/intercept", creditController.checkCreditIntercept);
creditRouter.post("/:customerId/auto-init", requirePermission("customer:credit"), creditController.autoInitCredit);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/credits",
  router: creditRouter,
  auth: "requireAuthWithTenant",
};
