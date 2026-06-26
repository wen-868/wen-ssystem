import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as subscriptionPlanController from "../controllers/admin/subscription-plan.controller.js";
import * as subscriptionController from "../controllers/admin/subscription.controller.js";
import * as subscriptionRenewalController from "../controllers/admin/subscription-renewal.controller.js";

export const subscriptionRouter = Router();

// ========== 套餐 ==========
subscriptionRouter.get("/plans", subscriptionPlanController.listPlans);
subscriptionRouter.get("/plans/:planId", subscriptionPlanController.getPlan);
subscriptionRouter.post("/plans", requireAuthWithTenant, subscriptionPlanController.createPlan);
subscriptionRouter.put("/plans/:planId", requireAuthWithTenant, subscriptionPlanController.updatePlan);

// ========== 订阅 ==========
subscriptionRouter.get("/", requireAuthWithTenant, subscriptionController.listSubscriptions);
subscriptionRouter.get("/:subscriptionId", requireAuthWithTenant, subscriptionController.getSubscription);
subscriptionRouter.post("/", requireAuthWithTenant, subscriptionController.createSubscription);
subscriptionRouter.post("/:subscriptionId/change-plan", requireAuthWithTenant, subscriptionController.changePlan);
subscriptionRouter.post("/:subscriptionId/cancel", requireAuthWithTenant, subscriptionController.cancelSubscription);
subscriptionRouter.post("/:subscriptionId/pay", requireAuthWithTenant, subscriptionController.paySubscription);

// ========== 续费 ==========
subscriptionRouter.post("/:subscriptionId/renew", requireAuthWithTenant, subscriptionRenewalController.renewSubscription);
subscriptionRouter.get("/expiring/list", requireAuthWithTenant, subscriptionRenewalController.listExpiring);
subscriptionRouter.get("/expired/list", requireAuthWithTenant, subscriptionRenewalController.listExpired);