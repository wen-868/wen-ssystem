import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as giftRuleController from "../controllers/admin/marketing-gift-rule.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const marketingGiftRuleRouter = Router();

// ==================== 满赠规则 (Admin) ====================
// S3-226（第 43 项 B2 批 8 · 营销域接线）：满赠规则 8 条写端点挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web 页面 `marketing/MarketingGiftRule.vue:436/277/433`（页面 `router/index.ts:223` 角色 = SUPER_ADMIN）；
// 其余 5 条（delete / activate / pause / levels 三态）全仓无页面调用点（`api/marketing.ts` 无对应封装）；
// 生产持有 `marketing:create` = SUPER_ADMIN / OPERATION_ADMIN ⊇ {SUPER_ADMIN} ⇒ 零回归（app-mobile 零命中）。
marketingGiftRuleRouter.post("/", requirePermission("marketing:create"), giftRuleController.createGiftRule);
marketingGiftRuleRouter.get("/", giftRuleController.listGiftRules);
marketingGiftRuleRouter.get("/:id", giftRuleController.getGiftRuleDetail);
marketingGiftRuleRouter.put("/:id", requirePermission("marketing:create"), giftRuleController.updateGiftRule);
marketingGiftRuleRouter.delete("/:id", requirePermission("marketing:create"), giftRuleController.deleteGiftRule);
marketingGiftRuleRouter.post("/:id/activate", requirePermission("marketing:create"), giftRuleController.activateGiftRule);
marketingGiftRuleRouter.post("/:id/pause", requirePermission("marketing:create"), giftRuleController.pauseGiftRule);
marketingGiftRuleRouter.post("/:id/levels", requirePermission("marketing:create"), giftRuleController.addGiftRuleLevel);
marketingGiftRuleRouter.put("/:id/levels/:levelId", requirePermission("marketing:create"), giftRuleController.updateGiftRuleLevel);
marketingGiftRuleRouter.delete("/:id/levels/:levelId", requirePermission("marketing:create"), giftRuleController.deleteGiftRuleLevel);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/gift-rules",
  router: marketingGiftRuleRouter,
  auth: "requireAuthWithTenant",
};
