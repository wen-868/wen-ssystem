import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
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