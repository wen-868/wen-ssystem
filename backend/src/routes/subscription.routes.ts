import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuth } from "../middleware/auth";
import * as subscriptionPlanController from "../controllers/admin/subscription-plan.controller";
import * as subscriptionController from "../controllers/admin/subscription.controller";
import * as subscriptionRenewalController from "../controllers/admin/subscription-renewal.controller";

export const subscriptionRouter = Router();

// ========== 套餐 ==========
subscriptionRouter.get("/plans", subscriptionPlanController.listPlans);
subscriptionRouter.get("/plans/:planId", subscriptionPlanController.getPlan);
subscriptionRouter.post("/plans", requireAuth, subscriptionPlanController.createPlan);
subscriptionRouter.put("/plans/:planId", requireAuth, subscriptionPlanController.updatePlan);

// ========== 订阅 ==========
subscriptionRouter.get("/", requireAuth, subscriptionController.listSubscriptions);
subscriptionRouter.get("/:subscriptionId", requireAuth, subscriptionController.getSubscription);
subscriptionRouter.post("/", requireAuth, subscriptionController.createSubscription);
subscriptionRouter.post("/:subscriptionId/change-plan", requireAuth, subscriptionController.changePlan);
subscriptionRouter.post("/:subscriptionId/cancel", requireAuth, subscriptionController.cancelSubscription);
subscriptionRouter.post("/:subscriptionId/pay", requireAuth, subscriptionController.paySubscription);

// ========== 续费 ==========
subscriptionRouter.post("/:subscriptionId/renew", requireAuth, subscriptionRenewalController.renewSubscription);
subscriptionRouter.get("/expiring/list", requireAuth, subscriptionRenewalController.listExpiring);
subscriptionRouter.get("/expired/list", requireAuth, subscriptionRenewalController.listExpired);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/subscriptions",
  router: subscriptionRouter,
  auth: "requireAuth",
};
