import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/purchase-return.controller.js";

export const purchaseReturnRouter = Router();

purchaseReturnRouter.get("/", requireAuthWithTenant, controller.list);
purchaseReturnRouter.get("/:returnNo", requireAuthWithTenant, controller.getDetail);
purchaseReturnRouter.post("/", requireAuthWithTenant, controller.create);
purchaseReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, controller.approve);
purchaseReturnRouter.post("/:returnNo/void", requireAuthWithTenant, controller.voidReturn);