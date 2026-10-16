import { Router } from "express";

import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingFullReductionRouter = Router();

// 满减活动管理
// S3-226（第 43 项 B2 批 8 · 营销域接线）：新建 / 编辑满减活动挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `marketing/FullReduction.vue:347/344`、`marketing/MarketingView.vue:475`
//（页面 `router/index.ts:229/:220` 角色 = SUPER_ADMIN）；app-mobile `activityApi.create/update`
//（`api/modules/marketing-activities.ts:73/78`）**无任何页面调用**（`rg 'activityApi\.(create|update)' app-mobile/src` 零命中）
// ⇒ 使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归。
adminMarketingFullReductionRouter.post("/full-reductions", requirePermission("marketing:create"), fullReductionController.createFullReduction);
adminMarketingFullReductionRouter.get("/full-reductions", fullReductionController.listFullReductions);
adminMarketingFullReductionRouter.get("/full-reductions/:id", fullReductionController.getFullReduction);
adminMarketingFullReductionRouter.put("/full-reductions/:id", requirePermission("marketing:create"), fullReductionController.updateFullReduction);
// S3-233（B 类收编第一批 · 营销域）：删 / 启停满减活动挂 `marketing:create`（与 :15/:18 同码同文件）。
// 依据门 = permission-gates.ts 的 `mkt-activities`（功能中心「营销活动」入口）；B 类前提（该页经推送深链/
// 首页快捷入口无条件可达）已由 S3-230 的入口权限门修复。
adminMarketingFullReductionRouter.delete("/full-reductions/:id", requirePermission("marketing:create"), fullReductionController.deleteFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/activate", requirePermission("marketing:create"), fullReductionController.activateFullReduction);
adminMarketingFullReductionRouter.post("/full-reductions/:id/pause", requirePermission("marketing:create"), fullReductionController.pauseFullReduction);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingFullReductionRouter,
  auth: "requireAuthWithTenant",
};
