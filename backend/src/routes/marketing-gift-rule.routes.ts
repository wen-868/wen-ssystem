import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as giftRuleController from "../controllers/admin/marketing-gift-rule.controller.js";

export const marketingGiftRuleRouter = Router();

// ==================== 满赠规则 (Admin) ====================
marketingGiftRuleRouter.post("/", requireAuthWithTenant, giftRuleController.createGiftRule);
marketingGiftRuleRouter.get("/", requireAuthWithTenant, giftRuleController.listGiftRules);
marketingGiftRuleRouter.get("/:id", requireAuthWithTenant, giftRuleController.getGiftRuleDetail);
marketingGiftRuleRouter.put("/:id", requireAuthWithTenant, giftRuleController.updateGiftRule);
marketingGiftRuleRouter.delete("/:id", requireAuthWithTenant, giftRuleController.deleteGiftRule);
marketingGiftRuleRouter.post("/:id/activate", requireAuthWithTenant, giftRuleController.activateGiftRule);
marketingGiftRuleRouter.post("/:id/pause", requireAuthWithTenant, giftRuleController.pauseGiftRule);
marketingGiftRuleRouter.post("/:id/levels", requireAuthWithTenant, giftRuleController.addGiftRuleLevel);
marketingGiftRuleRouter.put("/:id/levels/:levelId", requireAuthWithTenant, giftRuleController.updateGiftRuleLevel);
marketingGiftRuleRouter.delete("/:id/levels/:levelId", requireAuthWithTenant, giftRuleController.deleteGiftRuleLevel);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/gift-rules",
  router: marketingGiftRuleRouter,
  auth: "requireAuthWithTenant",
};
