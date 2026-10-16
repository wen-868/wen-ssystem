import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as pointsController from "../controllers/admin/points.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const pointsRouter = Router();
pointsRouter.get("/rules", pointsController.listPointsRules);
// S3-226（第 43 项 B2 批 8 · 营销域接线）：积分规则增/改挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `customer/PointsRules.vue:215/212`（页面 `router/index.ts:149` 角色 = SUPER_ADMIN）；
// 生产持有 `marketing:create` ⊇ {SUPER_ADMIN} ⇒ 零回归（app-mobile / miniapp 零命中）。
pointsRouter.post("/rules", requirePermission("marketing:create"), pointsController.createPointsRule);
pointsRouter.put("/rules/:id", requirePermission("marketing:create"), pointsController.updatePointsRule);
pointsRouter.post("/:id/points/adjust", pointsController.adjustCustomerPoints);
pointsRouter.get("/:id/points/records", pointsController.getCustomerPointsRecords);
pointsRouter.get("/levels/config", pointsController.listLevelConfigs);
// ⚠️ 会员等级配置 4 条（增/改/启停/删）本批**不接**：app-mobile 会员等级页有真实写调用点
//（`member-levels/member-levels.vue:117/137`、`member-levels/level-config.vue:119/161/164`），
// 而该页注册码 `customer:level`（`function-menu.ts:69`）在生产按菜单前缀对 **STORE_MANAGER / SALES_STAFF / CUSTOMER_SERVICE**
// 均可见（`docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md:113-122`），这三类工作角色都**不持** `marketing:*`
// ⇒ 接线即 403 回归（A 类·待授权模型定案，见台账 §十五.6）。
// S3-229（批 9）：按授权模型提案 **D2** 复核后**维持不接** —— D2 的前提是「营销菜单可见角色只含
// OPERATION_ADMIN(0 账号)/READONLY/STORE_ADMIN(0 账号)」，而本页注册码是 `customer:level`（不在该前提内）：
// 生产在用角色 **STORE_MANAGER**（1 账号）对该页可见（`docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md` 表 B
// `customer:level` 列 = 1/1/✓；生产持码 `customer:*`），且**不持** `marketing:create` ⇒ 挂 `marketing:create`
// 会把在用店长打成 403（违反不变量 I1）。故 4 条按 **W 类**登记，待凌舟裁定码位（`customer:level` / 补授权 / 前端门）。
// ⚠️ `POST /:id/points/adjust`（会员积分调整）本批**不接**：app-mobile `member-detail.vue:540` 有写调用点，
// 而该页经首页快捷入口「会员管理」`pages/home/home.vue:87` **无条件可达** ⇒ 使用者集合不可枚举（B 类）。
pointsRouter.post("/levels/config", pointsController.createLevelConfig);
pointsRouter.put("/levels/config/:id", pointsController.updateLevelConfig);
pointsRouter.put("/levels/config/:id/status", pointsController.updateLevelConfigStatus);
pointsRouter.delete("/levels/config/:id", pointsController.deleteLevelConfig);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members",
  router: pointsRouter,
  auth: "requireAuthWithTenant",
};
