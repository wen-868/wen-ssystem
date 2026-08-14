import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as creditController from "../controllers/admin/credit.controller";
import * as creditAdjustController from "../controllers/admin/credit-adjust.controller";

export const creditRouter = Router();

// ========================================================================
// 授信额度管理
// ========================================================================
creditRouter.get("/credits", creditController.getCreditList);
creditRouter.get("/credits/:customerId", creditController.getCreditDetail);
creditRouter.post("/credits/:customerId", creditController.initCredit);
creditRouter.get("/credits/:customerId/check", creditController.checkCredit);
creditRouter.post("/credits/:customerId/occupy", creditController.occupyCredit);
creditRouter.post("/credits/:customerId/release", creditController.releaseCredit);
creditRouter.post("/credits/:customerId/freeze", creditController.freezeCredit);
creditRouter.post("/credits/:customerId/unfreeze", creditController.unfreezeCredit);

// 额度调整
// ========================================================================
creditRouter.put("/credits/:customerId/limit", creditAdjustController.adjustLimit);
creditRouter.put("/credits/:customerId/term", creditAdjustController.adjustTerm);

// ========================================================================
// 信用评分与风控（赊销风控引擎）
// ========================================================================
creditRouter.post("/credits/:customerId/evaluate", creditController.evaluateCredit);
creditRouter.get("/credits/:customerId/intercept", creditController.checkCreditIntercept);
creditRouter.post("/credits/:customerId/auto-init", creditController.autoInitCredit);
creditRouter.get("/credits/strategy/collection", creditController.getCollectionStrategyConfig);
creditRouter.get("/credits/strategy/tiers", creditController.getCreditTiers);

// ========================================================================
// 催收管理
// ========================================================================
creditRouter.get("/collections", creditController.getCollectionList);
creditRouter.post("/collections", creditController.createCollection);
creditRouter.put("/collections/:id", creditController.updateCollection);
creditRouter.get("/collections/overdue", creditController.getOverdueCustomers);
creditRouter.post("/collections/auto-generate", creditController.autoGenerateCollections);
creditRouter.post("/collections/batch-remind", creditController.batchRemind);
creditRouter.get("/collections/statistics", creditController.getCollectionStatistics);

// ========================================================================
// 风险客户
// ========================================================================
creditRouter.get("/risk-customers", creditController.getRiskCustomers);
creditRouter.get("/risk-list", creditController.getRiskCustomers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/credits",
  router: creditRouter,
  auth: "requireAuthWithTenant",
};
