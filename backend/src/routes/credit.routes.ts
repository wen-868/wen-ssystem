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
creditRouter.post("/collections", creditController.createCollection);
creditRouter.put("/collections/:id", creditController.updateCollection);
creditRouter.get("/collections/overdue", creditController.getOverdueCustomers);
creditRouter.post("/collections/auto-generate", creditController.autoGenerateCollections);
creditRouter.post("/collections/batch-remind", creditController.batchRemind);
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
creditRouter.put("/:customerId/limit", creditAdjustController.adjustLimit);
creditRouter.put("/:customerId/term", creditAdjustController.adjustTerm);

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
