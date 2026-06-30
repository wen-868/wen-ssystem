import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as purchasePlanController from "../controllers/admin/purchase-plan.controller.js";

export const purchasePlanRouter = Router();

purchasePlanRouter.get("/suggest", requireAuthWithTenant, purchasePlanController.suggestPurchasePlan);
purchasePlanRouter.post("/", requireAuthWithTenant, purchasePlanController.createPurchasePlan);
purchasePlanRouter.get("/", requireAuthWithTenant, purchasePlanController.listPurchasePlans);
purchasePlanRouter.post("/:planNo/convert", requireAuthWithTenant, purchasePlanController.convertPurchasePlan);