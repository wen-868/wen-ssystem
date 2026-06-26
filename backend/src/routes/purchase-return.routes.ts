import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/purchase-return.controller.js";

export const purchaseReturnRouter = Router();
purchaseReturnRouter.get("/", requireAuthWithTenant, ctrl.list);
purchaseReturnRouter.get("/:returnNo", requireAuthWithTenant, ctrl.getDetail);
purchaseReturnRouter.post("/", requireAuthWithTenant, ctrl.create);
purchaseReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, ctrl.approve);
purchaseReturnRouter.post("/:returnNo/void", requireAuthWithTenant, ctrl.voidReturn);