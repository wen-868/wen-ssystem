import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as svcController from "../controllers/admin/store-value-card.controller";

export const storeValueCardRouter = Router();
storeValueCardRouter.get("/", svcController.listStoreValueCards);
storeValueCardRouter.post("/", svcController.createStoreValueCard);
storeValueCardRouter.get("/:cardNo", svcController.getStoreValueCard);
storeValueCardRouter.post("/:cardNo/recharge", svcController.rechargeCard);
storeValueCardRouter.post("/:cardNo/consume", svcController.consumeCard);
storeValueCardRouter.post("/:cardNo/refund", svcController.refundCard);
storeValueCardRouter.post("/:cardNo/freeze", svcController.freezeCard);
storeValueCardRouter.post("/:cardNo/unfreeze", svcController.unfreezeCard);
storeValueCardRouter.get("/:cardNo/transactions", svcController.listStoreValueTransactions);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/store-value-cards",
  router: storeValueCardRouter,
  auth: "requireAuthWithTenant",
};
