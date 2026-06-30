import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as svcController from "../controllers/admin/store-value-card.controller.js";

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