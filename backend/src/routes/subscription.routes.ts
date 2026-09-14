import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as subscriptionPlanController from "../controllers/admin/subscription-plan.controller";
import * as subscriptionController from "../controllers/admin/subscription.controller";
import * as subscriptionRenewalController from "../controllers/admin/subscription-renewal.controller";

export const subscriptionRouter = Router();

// ========== 套餐 ==========
subscriptionRouter.get("/plans", subscriptionPlanController.listPlans);
subscriptionRouter.get("/plans/:planId", subscriptionPlanController.getPlan);
subscriptionRouter.post("/plans", requirePlatformAuth, subscriptionPlanController.createPlan);
subscriptionRouter.put("/plans/:planId", requirePlatformAuth, subscriptionPlanController.updatePlan);

// R101-S2-02 组1：套餐策略配置（升降级 / 续费 / 扩展额度 / 限时活动）
// 落 t_platform_config: platform='SAAS', config_key='plan_policy:<planId>'（不新建表）
subscriptionRouter.get("/plans/:planId/policy", requirePlatformAuth, subscriptionPlanController.getPlanPolicy);
subscriptionRouter.put("/plans/:planId/policy", requirePlatformAuth, subscriptionPlanController.updatePlanPolicy);

// ========== 订阅 ==========
subscriptionRouter.get("/", requirePlatformAuth, subscriptionController.listSubscriptions);
subscriptionRouter.get("/:subscriptionId", requirePlatformAuth, subscriptionController.getSubscription);
subscriptionRouter.post("/", requirePlatformAuth, subscriptionController.createSubscription);
subscriptionRouter.post("/:subscriptionId/change-plan", requirePlatformAuth, subscriptionController.changePlan);
subscriptionRouter.post("/:subscriptionId/cancel", requirePlatformAuth, subscriptionController.cancelSubscription);
subscriptionRouter.post("/:subscriptionId/pay", requirePlatformAuth, subscriptionController.paySubscription);

// ========== 续费 ==========
subscriptionRouter.post("/:subscriptionId/renew", requirePlatformAuth, subscriptionRenewalController.renewSubscription);
subscriptionRouter.get("/expiring/list", requirePlatformAuth, subscriptionRenewalController.listExpiring);
subscriptionRouter.get("/expired/list", requirePlatformAuth, subscriptionRenewalController.listExpired);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/subscriptions-management",
  router: subscriptionRouter,
  auth: "requirePlatformAuth",
};
