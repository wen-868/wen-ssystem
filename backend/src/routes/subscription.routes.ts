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
