import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as paymentNewController from "../controllers/admin/payment-new.controller";

export const paymentNewRouter = Router();
// ⚠️ S3-223 **本行不接**：`POST /api/admin/payments-new/` 落在 `rbac-g0-wiring.test.ts:704` 的
// 「范围控制」名单（断言 READONLY 仍 200），且 app-mobile 开单页有写调用点
//（`pages/sales/create-sale.vue:2218`）⇒ 已被 `rbac-g1-wiring.test.ts:283` / `rbac-g2-wiring.test.ts:327-337`
// 锁为「C 类待裁」，本批不自行改口径（见回执 §三）。
paymentNewRouter.post("/", paymentNewController.createPayment);
paymentNewRouter.get("/", paymentNewController.listPayments);
paymentNewRouter.get("/:paymentNo", paymentNewController.getPaymentDetail);
paymentNewRouter.post("/:paymentNo/writeoff", requirePermission("finance:payment"), paymentNewController.writeoffPayment);
// S3-223（财务域接线 · B2 批 5）：作废付款单挂**同文件既有码** `finance:payment`（付款动作用码；
// 持有者（生产实测）＝ 超管/运营 + 财务 `finance:*` + 店长精确码 `finance:payment`）。
// 使用者 = 桌面 `views/finance/PaymentsNewView.vue:369`（页面 `router/index.ts:198` [SUPER_ADMIN]）；
// app-mobile 付款单 API 只有 create/list（`api/modules/finance.ts:126-134`）⇒ 无移动端作废调用点，零回归。
paymentNewRouter.post("/:paymentNo/void", requirePermission("finance:payment"), paymentNewController.voidPayment);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/payments-new",
  router: paymentNewRouter,
  auth: "requireAuthWithTenant",
};
