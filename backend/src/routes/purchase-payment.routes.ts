import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-payment.controller";

export const purchasePaymentRouter = Router();
purchasePaymentRouter.get("/", ctrl.list);
purchasePaymentRouter.get("/:paymentNo", ctrl.getDetail);
// S3-233（B 类收编第一批 · 采购域）：创建采购付款单挂 `finance:payment`（同文件 approve / void 同码，:13-14）。
// 依据门 = permission-gates.ts 的 `purchase-sub-payment`（开单页「采购 → 付款单」子段，入口已按该码显隐）。
// S3-214-B2 的「无权限门」前提已由 S3-230 修复，故本行据此收编。
purchasePaymentRouter.post("/", requirePermission("finance:payment"), ctrl.create);
purchasePaymentRouter.post("/:paymentNo/approve", requirePermission("finance:payment"), ctrl.approve);
purchasePaymentRouter.post("/:paymentNo/void", requirePermission("finance:payment"), ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-payments",
  router: purchasePaymentRouter,
  auth: "requireAuthWithTenant",
};
