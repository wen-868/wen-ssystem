import { Router } from "express";

import * as stackRuleController from "../controllers/admin/marketing-stack-rule.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingStackRuleRouter = Router();

// 叠加规则管理
adminMarketingStackRuleRouter.post("/stack-rules", stackRuleController.createStackRule);
adminMarketingStackRuleRouter.get("/stack-rules", stackRuleController.listStackRules);
adminMarketingStackRuleRouter.put("/stack-rules/:id", stackRuleController.updateStackRule);
adminMarketingStackRuleRouter.delete("/stack-rules/:id", stackRuleController.deleteStackRule);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingStackRuleRouter,
  auth: "requireAuthWithTenant",
};