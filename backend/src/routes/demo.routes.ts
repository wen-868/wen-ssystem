import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import { seedDemo, resetSystem } from "../controllers/admin/demo.controller";

export const demoRouter = Router();

// 演示数据初始化（幂等）与系统初始化（需超级管理员，二次确认）
// S3-229（第 43 项 B2 批 9 · 门店/租户域接线）：本文件 2 条写端点挂 `store:create`（台账 §三.7 域内建议码）。
// 依据（逐条可核对）：① 唯一调用点是 admin-web 登录页「演示登录」流程
//   （`views/LoginView.vue:257` `seedDemoData()`，由 `api/common.ts:17/23` 封装），该流程用 `DEMO_ACCOUNT`（= `admin`，
//   生产角色 `SUPER_ADMIN`，权限串 `["*"]`）登录后立即调用 ⇒ 页面真实使用者 ⊆ 码持有人；
//   ② `POST /api/admin/demo/reset` 六端全仓零调用点（`rg -F 'demo/reset'` 仅命中封装行）；
//   ③ 两行都不在 app-mobile / miniapp / saas-admin 的任何页面上 ⇒ 无「无门页可达」风险（非 B 类）。
// ⇒ 挂码后零回归（`requirePermission` 对 `SUPER_ADMIN` 直接放行，见 `middleware/rbac-auth.ts:14`）。
demoRouter.post("/seed", requirePermission("store:create"), asyncHandler(seedDemo));
demoRouter.post("/reset", requirePermission("store:create"), asyncHandler(resetSystem));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/demo",
  router: demoRouter,
  auth: "requireAuthWithTenant",
};
