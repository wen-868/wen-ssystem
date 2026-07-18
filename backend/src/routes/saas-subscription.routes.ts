import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as subscriptionController from "../controllers/saas/subscription.controller";

export const saasSubscriptionRouter = Router();

saasSubscriptionRouter.use(requirePlatformAuth);

saasSubscriptionRouter.get("/", subscriptionController.listSubscriptions);

saasSubscriptionRouter.get("/:id", subscriptionController.getSubscriptionDetail);

saasSubscriptionRouter.post("/", subscriptionController.createSubscription);

saasSubscriptionRouter.post("/:id/renew", subscriptionController.renewSubscription);

saasSubscriptionRouter.post("/:id/upgrade", subscriptionController.upgradeSubscription);

saasSubscriptionRouter.post("/:id/cancel", subscriptionController.cancelSubscription);

saasSubscriptionRouter.get("/statistics/overview", subscriptionController.getSubscriptionStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/saas/subscriptions",
  router: saasSubscriptionRouter,
  auth: "requirePlatformAuth",
};
