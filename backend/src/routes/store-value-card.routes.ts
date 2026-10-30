import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as svcController from "../controllers/admin/store-value-card.controller";

export const storeValueCardRouter = Router();
storeValueCardRouter.get("/", svcController.listStoreValueCards);
// TOTAL-MEMBER-PERMISSION-CODES-01（2026-10-30，凌舟裁定）：开卡/充值两行原**仅认证无权限码**
// （MOBILE-32F4 实证）⇒ 立码 `finance:create`（既有码，与同文件 consume/refund 行同码同域）；
// TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01（2026-10-31，凌舟裁定）：freeze/unfreeze 两行原
// **仅认证无权限码**（本卡 §二）⇒ 同码 `finance:create`（同文件开卡/充值/消费/退款同码；
// 同域先例 bank-account.routes.ts freeze/unfreeze 也是 finance:create）。
// 逐行断言见 total-value-card-lifecycle-codes-wiring.test.ts。
storeValueCardRouter.post("/", requirePermission("finance:create"), svcController.createStoreValueCard);
storeValueCardRouter.get("/:cardNo", svcController.getStoreValueCard);
storeValueCardRouter.post("/:cardNo/recharge", requirePermission("finance:create"), svcController.rechargeCard);
storeValueCardRouter.post("/:cardNo/consume", requirePermission("finance:create"), svcController.consumeCard);
storeValueCardRouter.post("/:cardNo/refund", requirePermission("finance:create"), svcController.refundCard);
storeValueCardRouter.post("/:cardNo/freeze", requirePermission("finance:create"), svcController.freezeCard);
storeValueCardRouter.post("/:cardNo/unfreeze", requirePermission("finance:create"), svcController.unfreezeCard);
storeValueCardRouter.get("/:cardNo/transactions", svcController.listStoreValueTransactions);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/store-value-cards",
  router: storeValueCardRouter,
  auth: "requireAuthWithTenant",
};
