import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-payment.controller";

export const purchasePaymentRouter = Router();
purchasePaymentRouter.get("/", ctrl.list);
purchasePaymentRouter.get("/:paymentNo", ctrl.getDetail);
// ⚠️ S3-214-B2 **本行不接线**：移动端「销售开单」采购页签无权限门 ⇒ 同 purchase.routes.ts 说明。
purchasePaymentRouter.post("/", ctrl.create);
purchasePaymentRouter.post("/:paymentNo/approve", requirePermission("finance:payment"), ctrl.approve);
purchasePaymentRouter.post("/:paymentNo/void", requirePermission("finance:payment"), ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-payments",
  router: purchasePaymentRouter,
  auth: "requireAuthWithTenant",
};
