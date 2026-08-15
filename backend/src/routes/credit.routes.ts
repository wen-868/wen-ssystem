import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as creditController from "../controllers/admin/credit.controller";
import * as creditAdjustController from "../controllers/admin/credit-adjust.controller";

export const creditRouter = Router();

// ========================================================================
// 授信额度管理
// ========================================================================
creditRouter.get("/", creditController.getCreditList);
creditRouter.get("/:customerId", creditController.getCreditDetail);
creditRouter.post("/:customerId", creditController.initCredit);
creditRouter.get("/:customerId/check", creditController.checkCredit);
creditRouter.post("/:customerId/occupy", creditController.occupyCredit);
creditRouter.post("/:customerId/release", creditController.releaseCredit);
creditRouter.post("/:customerId/freeze", creditController.freezeCredit);
creditRouter.post("/:customerId/unfreeze", creditController.unfreezeCredit);

// 额度调整
// ========================================================================
creditRouter.put("/:customerId/limit", creditAdjustController.adjustLimit);
creditRouter.put("/:customerId/term", creditAdjustController.adjustTerm);

// ========================================================================
// 信用评分与风控（赊销风控引擎）
// ========================================================================
creditRouter.post("/:customerId/evaluate", creditController.evaluateCredit);
creditRouter.get("/:customerId/intercept", creditController.checkCreditIntercept);
creditRouter.post("/:customerId/auto-init", creditController.autoInitCredit);
creditRouter.get("/strategy/collection", creditController.getCollectionStrategyConfig);
creditRouter.get("/strategy/tiers", creditController.getCreditTiers);

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
