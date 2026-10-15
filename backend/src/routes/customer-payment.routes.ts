import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：客户收款/作废 = 079:149 既有「客户收款」码 `customer:payment`
//（语义精确；全仓无页面调用方 ⇒ 零回归），未照台账的机器建议 `customer:create`（见回执 §差异）。
import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/customer-payment.controller";

export const customerPaymentRouter = Router();

customerPaymentRouter.get("/", ctrl.list);
customerPaymentRouter.get("/:receiptNo", ctrl.getDetail);
customerPaymentRouter.post("/", requirePermission("customer:payment"), ctrl.create);
customerPaymentRouter.post("/:receiptNo/void", requirePermission("customer:payment"), ctrl.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-payments",
  router: customerPaymentRouter,
  auth: "requireAuthWithTenant",
};
