import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/purchase-in-stock.controller.js";

export const purchaseInStockRouter = Router();

purchaseInStockRouter.get("/", requireAuthWithTenant, controller.list);
purchaseInStockRouter.get("/:stockNo", requireAuthWithTenant, controller.getDetail);
purchaseInStockRouter.post("/", requireAuthWithTenant, controller.create);
purchaseInStockRouter.post("/:stockNo/approve", requireAuthWithTenant, controller.approve);
purchaseInStockRouter.post("/:stockNo/void", requireAuthWithTenant, controller.voidStock);