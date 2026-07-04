import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as stackRuleController from "../controllers/admin/marketing-stack-rule.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

export const adminMarketingStackRuleRouter = Router();

// 叠加规则管理
adminMarketingStackRuleRouter.post("/stack-rules", requireAuthWithTenant, stackRuleController.createStackRule);
adminMarketingStackRuleRouter.get("/stack-rules", requireAuthWithTenant, stackRuleController.listStackRules);
adminMarketingStackRuleRouter.put("/stack-rules/:id", requireAuthWithTenant, stackRuleController.updateStackRule);
adminMarketingStackRuleRouter.delete("/stack-rules/:id", requireAuthWithTenant, stackRuleController.deleteStackRule);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingStackRuleRouter,
  auth: "none",
};