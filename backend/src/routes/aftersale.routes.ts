import { Router } from "express";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requirePermission } from "../middleware/rbac-auth";
import { asyncHandler } from "../middleware/async-handler";
import * as ctrl from "../controllers/admin/aftersale.controller";
import {
  createAftersaleSchema,
  returnLogisticsSchema,
  rateAftersaleSchema,
  rejectAftersaleSchema,
  inspectAftersaleSchema,
  completeAftersaleSchema,
} from "../schemas/aftersale";
import type { RouteConfig } from "../shared/auto-routes";

export const miniappAftersaleRouter = Router();
export const adminAftersaleRouter = Router();

// ==================== 小程序售后（写端点：认证 + CSRF 防护，S3-177） ====================
// 本文件是双配置路由（routeConfigs：miniapp + admin 两条）；小程序分支没有公开端点，
// 但既有单测 backend/src/__tests__/routes/aftersale.test.ts 断言 routeConfigs[0].auth === "none"，
// 且本单红线限定"只碰这 3 个文件"，故不改声明式，按既有合规写法在写端点显式挂载
// 认证 + csrfMiddleware（与 platform-auth.routes.ts:46 同款、顺序必须认证在前）。
// S3-196（总清单第 52 项）：小程序分支的认证改为 requireConsumerAuthWithTenant ——
// 老 miniapp 只有微信令牌，消费者端点必须能按「微信令牌 → 绑定会员」解析身份。
miniappAftersaleRouter.post("/aftersales", requireConsumerAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = createAftersaleSchema.parse(req.body);
  await ctrl.miniappCreateAftersale(req, res, _next);
}));

miniappAftersaleRouter.get("/aftersales/mine", requireConsumerAuthWithTenant, ctrl.miniappListMyAftersales);
miniappAftersaleRouter.get("/aftersales/:aftersaleNo", requireConsumerAuthWithTenant, ctrl.miniappGetAftersaleDetail);
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/cancel", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.miniappCancelAftersale);

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/return-logistics", requireConsumerAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = returnLogisticsSchema.parse(req.body);
  await ctrl.miniappSubmitReturnLogistics(req, res, _next);
}));

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/rate", requireConsumerAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = rateAftersaleSchema.parse(req.body);
  await ctrl.miniappRateAftersale(req, res, _next);
}));

adminAftersaleRouter.get("/aftersales", ctrl.adminListAftersales);
adminAftersaleRouter.get("/aftersales/statistics", ctrl.adminGetStatistics);
adminAftersaleRouter.get("/aftersales/:id", ctrl.adminGetAftersaleDetail);
adminAftersaleRouter.post("/aftersales/:id/approve", requirePermission("sale:return"), ctrl.adminApproveAftersale);

adminAftersaleRouter.post("/aftersales/:id/reject", requirePermission("sale:return"), asyncHandler(async (req, res, _next) => {
  req.body = rejectAftersaleSchema.parse(req.body);
  await ctrl.adminRejectAftersale(req, res, _next);
}));

// S3-224（第 43 项 B2 批 6 · 销售域接线）：售后「确认收货」挂 `sale:return`。
// 使用者 = admin-web `marketing/AftersaleView.vue:307`（页面 `router/index.ts:230` 角色 = SUPER_ADMIN）；
// ⚠️ 本仓 `t_sys_menu` **没有任何 `aftersale:*` 行**（`aftersale:*` 只是 CUSTOMER_SERVICE 的权限串通配，
// 见 `docs/migrations/079:92`、`128:36`）⇒ 售后域无"既有细码"可挂，取退货语义的细码 `sale:return`
//（生产持有 = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / STORE_OPERATOR ⊇ {SUPER_ADMIN}，零回归）。
// ⚠️ 同文件 approve / reject / inspect / complete 4 条 S3-224 当时**不接**：app-mobile
// `pages-sub/order/order-aftersale/aftersale.vue:144/178`（孤岛页，全仓无导航入口）有写调用点
// ⇒ 使用者集合不可枚举（B 类）。2026-10-16
// QODER-9（B3-1 收口，2026-10-19，`docs/tasks/inbox/QODER-9-B31收口.md`）：门注册表 `island-aftersale` 已提为
// `gated`（`app-mobile/src/config/permission-gates.ts:585-599`，codes = `sale:return`）⇒ parity 契约
// 「gated ⇒ 后端已接线」；凌舟裁定**改补后端、不再拆栈** ⇒ 4 条挂同族既有码 `sale:return`（零新码）。
adminAftersaleRouter.post("/aftersales/:id/confirm-receipt", requirePermission("sale:return"), ctrl.adminConfirmReceipt);

adminAftersaleRouter.post("/aftersales/:id/inspect", requirePermission("sale:return"), asyncHandler(async (req, res, _next) => {
  req.body = inspectAftersaleSchema.parse(req.body);
  await ctrl.adminInspectAftersale(req, res, _next);
}));

adminAftersaleRouter.post("/aftersales/:id/complete", requirePermission("sale:return"), asyncHandler(async (req, res, _next) => {
  req.body = completeAftersaleSchema.parse(req.body);
  await ctrl.adminCompleteAftersale(req, res, _next);
}));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/miniapp", router: miniappAftersaleRouter, auth: "none" },
  { prefix: "/api/admin", router: adminAftersaleRouter, auth: "requireAuthWithTenant" },
];
