import { Router } from "express";

import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingGroupBuyRouter = Router();

// 拼团活动管理
adminMarketingGroupBuyRouter.post("/group-buys", groupBuyController.createGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys", groupBuyController.listGroupBuys);
adminMarketingGroupBuyRouter.get("/group-buys/:id", groupBuyController.getGroupBuy);
adminMarketingGroupBuyRouter.put("/group-buys/:id", groupBuyController.updateGroupBuy);
adminMarketingGroupBuyRouter.delete("/group-buys/:id", groupBuyController.deleteGroupBuy);
adminMarketingGroupBuyRouter.post("/group-buys/:id/activate", groupBuyController.activateGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys/teams", groupBuyController.listGroupBuyTeams);
adminMarketingGroupBuyRouter.get("/group-buys/active/:activityId", groupBuyController.listActiveGroupBuys);
adminMarketingGroupBuyRouter.post("/group-buys/teams", groupBuyController.createGroupBuyTeam);
adminMarketingGroupBuyRouter.get("/group-buys/teams/:teamId", groupBuyController.getGroupBuyTeam);
adminMarketingGroupBuyRouter.post("/group-buys/teams/:teamId/join", groupBuyController.joinGroupBuyTeam);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingGroupBuyRouter,
  auth: "requireAuthWithTenant",
};