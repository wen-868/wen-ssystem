import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as giftRuleController from "../controllers/admin/marketing-gift-rule.controller";

export const marketingGiftRuleRouter = Router();

// ==================== 满赠规则 (Admin) ====================
marketingGiftRuleRouter.post("/", giftRuleController.createGiftRule);
marketingGiftRuleRouter.get("/", giftRuleController.listGiftRules);
marketingGiftRuleRouter.get("/:id", giftRuleController.getGiftRuleDetail);
marketingGiftRuleRouter.put("/:id", giftRuleController.updateGiftRule);
marketingGiftRuleRouter.delete("/:id", giftRuleController.deleteGiftRule);
marketingGiftRuleRouter.post("/:id/activate", giftRuleController.activateGiftRule);
marketingGiftRuleRouter.post("/:id/pause", giftRuleController.pauseGiftRule);
marketingGiftRuleRouter.post("/:id/levels", giftRuleController.addGiftRuleLevel);
marketingGiftRuleRouter.put("/:id/levels/:levelId", giftRuleController.updateGiftRuleLevel);
marketingGiftRuleRouter.delete("/:id/levels/:levelId", giftRuleController.deleteGiftRuleLevel);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/gift-rules",
  router: marketingGiftRuleRouter,
  auth: "requireAuthWithTenant",
};
