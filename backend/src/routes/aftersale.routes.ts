import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
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
// requireAuthWithTenant + csrfMiddleware（与 platform-auth.routes.ts:46 同款、顺序必须认证在前）。
miniappAftersaleRouter.post("/aftersales", requireAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = createAftersaleSchema.parse(req.body);
  await ctrl.miniappCreateAftersale(req, res, _next);
}));

miniappAftersaleRouter.get("/aftersales/mine", requireAuthWithTenant, ctrl.miniappListMyAftersales);
miniappAftersaleRouter.get("/aftersales/:aftersaleNo", requireAuthWithTenant, ctrl.miniappGetAftersaleDetail);
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/cancel", requireAuthWithTenant, csrfMiddleware, ctrl.miniappCancelAftersale);

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/return-logistics", requireAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = returnLogisticsSchema.parse(req.body);
  await ctrl.miniappSubmitReturnLogistics(req, res, _next);
}));

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/rate", requireAuthWithTenant, csrfMiddleware, asyncHandler(async (req, res, _next) => {
  req.body = rateAftersaleSchema.parse(req.body);
  await ctrl.miniappRateAftersale(req, res, _next);
}));

adminAftersaleRouter.get("/aftersales", ctrl.adminListAftersales);
adminAftersaleRouter.get("/aftersales/statistics", ctrl.adminGetStatistics);
adminAftersaleRouter.get("/aftersales/:id", ctrl.adminGetAftersaleDetail);
adminAftersaleRouter.post("/aftersales/:id/approve", ctrl.adminApproveAftersale);

adminAftersaleRouter.post("/aftersales/:id/reject", asyncHandler(async (req, res, _next) => {
  req.body = rejectAftersaleSchema.parse(req.body);
  await ctrl.adminRejectAftersale(req, res, _next);
}));

adminAftersaleRouter.post("/aftersales/:id/confirm-receipt", ctrl.adminConfirmReceipt);

adminAftersaleRouter.post("/aftersales/:id/inspect", asyncHandler(async (req, res, _next) => {
  req.body = inspectAftersaleSchema.parse(req.body);
  await ctrl.adminInspectAftersale(req, res, _next);
}));

adminAftersaleRouter.post("/aftersales/:id/complete", asyncHandler(async (req, res, _next) => {
  req.body = completeAftersaleSchema.parse(req.body);
  await ctrl.adminCompleteAftersale(req, res, _next);
}));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/miniapp", router: miniappAftersaleRouter, auth: "none" },
  { prefix: "/api/admin", router: adminAftersaleRouter, auth: "requireAuthWithTenant" },
];
