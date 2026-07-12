import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as svcController from "../controllers/admin/store-value-card.controller";

export const storeValueCardRouter = Router();
storeValueCardRouter.get("/", requireAuthWithTenant, svcController.listStoreValueCards);
storeValueCardRouter.post("/", requireAuthWithTenant, svcController.createStoreValueCard);
storeValueCardRouter.get("/:cardNo", requireAuthWithTenant, svcController.getStoreValueCard);
storeValueCardRouter.post("/:cardNo/recharge", requireAuthWithTenant, svcController.rechargeCard);
storeValueCardRouter.post("/:cardNo/consume", requireAuthWithTenant, svcController.consumeCard);
storeValueCardRouter.post("/:cardNo/refund", requireAuthWithTenant, svcController.refundCard);
storeValueCardRouter.post("/:cardNo/freeze", requireAuthWithTenant, svcController.freezeCard);
storeValueCardRouter.post("/:cardNo/unfreeze", requireAuthWithTenant, svcController.unfreezeCard);
storeValueCardRouter.get("/:cardNo/transactions", requireAuthWithTenant, svcController.listStoreValueTransactions);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/store-value-cards",
  router: storeValueCardRouter,
  auth: "requireAuthWithTenant",
};
