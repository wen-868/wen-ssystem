import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as aiBillingConfigController from "../controllers/admin/ai-billing-config.controller";

// R101-S2-02 组3：AI 类配置路由，独立前缀 /api/platform/ai-billing
// 由 auto-routes 自动发现挂载，无需改 server.ts
export const aiBillingRouter = Router();

aiBillingRouter.use(requirePlatformAuth);

// GET /api/platform/ai-billing/billing-strategy - 套餐加成倍率与月额度用尽策略
aiBillingRouter.get("/billing-strategy", aiBillingConfigController.getBillingStrategy);

// PUT /api/platform/ai-billing/billing-strategy - 保存套餐加成倍率包
aiBillingRouter.put("/billing-strategy", aiBillingConfigController.updateBillingStrategy);

// GET /api/platform/ai-billing/free-grant - 免费版赠送额度
aiBillingRouter.get("/free-grant", aiBillingConfigController.getFreeGrant);

// PUT /api/platform/ai-billing/free-grant - 保存免费版赠送额度
aiBillingRouter.put("/free-grant", aiBillingConfigController.updateFreeGrant);

// GET /api/platform/ai-billing/quota-packs - 额度包商品列表
aiBillingRouter.get("/quota-packs", aiBillingConfigController.getQuotaPacks);

// PUT /api/platform/ai-billing/quota-packs - 保存额度包商品列表
aiBillingRouter.put("/quota-packs", aiBillingConfigController.updateQuotaPacks);

// GET /api/platform/ai-billing/points-rate - 积分抵扣汇率
aiBillingRouter.get("/points-rate", aiBillingConfigController.getPointsRate);

// PUT /api/platform/ai-billing/points-rate - 保存积分抵扣汇率
aiBillingRouter.put("/points-rate", aiBillingConfigController.updatePointsRate);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/ai-billing",
  router: aiBillingRouter,
  auth: "requirePlatformAuth",
};
