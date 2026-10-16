import { Router } from "express";

import * as stackRuleController from "../controllers/admin/marketing-stack-rule.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingStackRuleRouter = Router();

// 叠加规则管理
// S3-226（第 43 项 B2 批 8 · 营销域接线）：叠加规则增/改/删挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `api/marketing.ts:244/248/252` 打的是 `/admin/marketing/promotions/stack-rules*`（**后端无此前缀**，调用即 404）
// ⇒ 全仓**无有效调用点**；使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归。
adminMarketingStackRuleRouter.post("/stack-rules", requirePermission("marketing:create"), stackRuleController.createStackRule);
adminMarketingStackRuleRouter.get("/stack-rules", stackRuleController.listStackRules);
adminMarketingStackRuleRouter.put("/stack-rules/:id", requirePermission("marketing:create"), stackRuleController.updateStackRule);
adminMarketingStackRuleRouter.delete("/stack-rules/:id", requirePermission("marketing:create"), stackRuleController.deleteStackRule);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingStackRuleRouter,
  auth: "requireAuthWithTenant",
};