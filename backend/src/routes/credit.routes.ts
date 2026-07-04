import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as creditController from "../controllers/admin/credit.controller.js";
import * as creditAdjustController from "../controllers/admin/credit-adjust.controller.js";

export const creditRouter = Router();

// ========================================================================
// 授信额度管理
// ========================================================================
creditRouter.get("/credits", requireAuthWithTenant, creditController.getCreditList);
creditRouter.get("/credits/:customerId", requireAuthWithTenant, creditController.getCreditDetail);
creditRouter.post("/credits/:customerId", requireAuthWithTenant, creditController.initCredit);
creditRouter.get("/credits/:customerId/check", requireAuthWithTenant, creditController.checkCredit);
creditRouter.post("/credits/:customerId/occupy", requireAuthWithTenant, creditController.occupyCredit);
creditRouter.post("/credits/:customerId/release", requireAuthWithTenant, creditController.releaseCredit);
creditRouter.post("/credits/:customerId/freeze", requireAuthWithTenant, creditController.freezeCredit);
creditRouter.post("/credits/:customerId/unfreeze", requireAuthWithTenant, creditController.unfreezeCredit);

// 额度调整
// ========================================================================
creditRouter.put("/credits/:customerId/limit", requireAuthWithTenant, creditAdjustController.adjustLimit);
creditRouter.put("/credits/:customerId/term", requireAuthWithTenant, creditAdjustController.adjustTerm);

// ========================================================================
// 信用评分与风控（赊销风控引擎）
// ========================================================================
creditRouter.post("/credits/:customerId/evaluate", requireAuthWithTenant, creditController.evaluateCredit);
creditRouter.get("/credits/:customerId/intercept", requireAuthWithTenant, creditController.checkCreditIntercept);
creditRouter.post("/credits/:customerId/auto-init", requireAuthWithTenant, creditController.autoInitCredit);
creditRouter.get("/credits/strategy/collection", requireAuthWithTenant, creditController.getCollectionStrategyConfig);
creditRouter.get("/credits/strategy/tiers", requireAuthWithTenant, creditController.getCreditTiers);

// ========================================================================
// 催收管理
// ========================================================================
creditRouter.get("/collections", requireAuthWithTenant, creditController.getCollectionList);
creditRouter.post("/collections", requireAuthWithTenant, creditController.createCollection);
creditRouter.put("/collections/:id", requireAuthWithTenant, creditController.updateCollection);
creditRouter.get("/collections/overdue", requireAuthWithTenant, creditController.getOverdueCustomers);
creditRouter.post("/collections/auto-generate", requireAuthWithTenant, creditController.autoGenerateCollections);
creditRouter.post("/collections/batch-remind", requireAuthWithTenant, creditController.batchRemind);
creditRouter.get("/collections/statistics", requireAuthWithTenant, creditController.getCollectionStatistics);

// ========================================================================
// 风险客户
// ========================================================================
creditRouter.get("/risk-customers", requireAuthWithTenant, creditController.getRiskCustomers);
creditRouter.get("/risk-list", requireAuthWithTenant, creditController.getRiskCustomers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/credits",
  router: creditRouter,
  auth: "requireAuthWithTenant",
};
