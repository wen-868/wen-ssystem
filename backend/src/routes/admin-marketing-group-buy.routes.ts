import { Router } from "express";

import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingGroupBuyRouter = Router();

// 拼团活动管理
// S3-226（第 43 项 B2 批 8 · 营销域接线）：拼团活动（管理面 `/api/admin/marketing/group-buys*`）6 条挂 `marketing:create`
//（台账 §三.4 域内建议码）。依据：admin-web `api/marketing.ts:182/186/190/194` 封装，页面 `marketing/MarketingView.vue:514/543`
//（`router/index.ts:220` 角色 = SUPER_ADMIN）；生产持有 `marketing:create` = SUPER_ADMIN / OPERATION_ADMIN ⇒ 零回归。
// ⚠️ 与 app-mobile `/api/marketing/group-buy/*`（`community-marketing.routes.ts`）是**两套不同前缀**，本文件接线不影响移动端。
adminMarketingGroupBuyRouter.post("/group-buys", requirePermission("marketing:create"), groupBuyController.createGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys", groupBuyController.listGroupBuys);
adminMarketingGroupBuyRouter.get("/group-buys/:id", groupBuyController.getGroupBuy);
adminMarketingGroupBuyRouter.put("/group-buys/:id", requirePermission("marketing:create"), groupBuyController.updateGroupBuy);
adminMarketingGroupBuyRouter.delete("/group-buys/:id", requirePermission("marketing:create"), groupBuyController.deleteGroupBuy);
adminMarketingGroupBuyRouter.post("/group-buys/:id/activate", requirePermission("marketing:create"), groupBuyController.activateGroupBuy);
adminMarketingGroupBuyRouter.get("/group-buys/teams", groupBuyController.listGroupBuyTeams);
adminMarketingGroupBuyRouter.get("/group-buys/active/:activityId", groupBuyController.listActiveGroupBuys);
adminMarketingGroupBuyRouter.post("/group-buys/teams", requirePermission("marketing:create"), groupBuyController.createGroupBuyTeam);
adminMarketingGroupBuyRouter.get("/group-buys/teams/:teamId", groupBuyController.getGroupBuyTeam);
adminMarketingGroupBuyRouter.post("/group-buys/teams/:teamId/join", requirePermission("marketing:create"), groupBuyController.joinGroupBuyTeam);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingGroupBuyRouter,
  auth: "requireAuthWithTenant",
};