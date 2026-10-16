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
// ⚠️ `POST /:id/points/adjust`（会员积分调整）本批**不接**：app-mobile `member-detail.vue:540` 有写调用点，
// 而该页经首页快捷入口「会员管理」`pages/home/home.vue:87` **无条件可达** ⇒ 使用者集合不可枚举（B 类）。
// S3-231（收尾批 · F1）：会员等级配置 4 条（增/改/启停/删）**改挂 `customer:level`**（页面**自身的注册码**，
// `app-mobile/src/config/function-menu.ts:84`）= 凌舟裁定 1（`R101-S3-229-凌舟验收与裁定.md` §二.1）。
// 满足不变量 I1'①（该码正是页面注册码）：店长经 `customer:*` 域通配命中（`matchPermission` 分支②：
// `customer:level` 的域 = `customer` ⇒ `customer:*` 命中）；原来取保守侧的 `marketing:create` 于本页无据（跨域）。
// 生产持 `customer:level` 的在用角色 = `STORE_MANAGER`（1 账号，持 `customer:*`）⇒ 零回归；
// `SALES_STAFF` / `CUSTOMER_SERVICE` 持精确码 `customer:view` ⇒ 域通配不命中 ⇒ 该两角色被降级（只读）；
// 影响面与"因缺码被关闭/降级的入口"逐条登记见 `docs/evidence/S3-231/F1/`。
pointsRouter.post("/levels/config", requirePermission("customer:level"), pointsController.createLevelConfig);
pointsRouter.put("/levels/config/:id", requirePermission("customer:level"), pointsController.updateLevelConfig);
pointsRouter.put("/levels/config/:id/status", requirePermission("customer:level"), pointsController.updateLevelConfigStatus);
pointsRouter.delete("/levels/config/:id", requirePermission("customer:level"), pointsController.deleteLevelConfig);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members",
  router: pointsRouter,
  auth: "requireAuthWithTenant",
};
