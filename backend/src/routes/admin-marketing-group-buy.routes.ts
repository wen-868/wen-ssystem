import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

export const adminMarketingGroupBuyRouter = Router();

// 拼团活动管理
adminMarketingGroupBuyRouter.post("/group-buys", requireAuthWithTenant, groupBuyController.createGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys", requireAuthWithTenant, groupBuyController.listGroupBuys);
adminMarketingGroupBuyRouter.get("/group-buys/:id", requireAuthWithTenant, groupBuyController.getGroupBuy);
adminMarketingGroupBuyRouter.put("/group-buys/:id", requireAuthWithTenant, groupBuyController.updateGroupBuy);
adminMarketingGroupBuyRouter.delete("/group-buys/:id", requireAuthWithTenant, groupBuyController.deleteGroupBuy);
adminMarketingGroupBuyRouter.post("/group-buys/:id/activate", requireAuthWithTenant, groupBuyController.activateGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys/teams", requireAuthWithTenant, groupBuyController.listGroupBuyTeams);
adminMarketingGroupBuyRouter.get("/group-buys/active/:activityId", requireAuthWithTenant, groupBuyController.listActiveGroupBuys);
adminMarketingGroupBuyRouter.post("/group-buys/teams", requireAuthWithTenant, groupBuyController.createGroupBuyTeam);
adminMarketingGroupBuyRouter.get("/group-buys/teams/:teamId", requireAuthWithTenant, groupBuyController.getGroupBuyTeam);
adminMarketingGroupBuyRouter.post("/group-buys/teams/:teamId/join", requireAuthWithTenant, groupBuyController.joinGroupBuyTeam);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingGroupBuyRouter,
  auth: "none",
};