import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as commissionController from "../controllers/admin/commission.controller.js";

export const commissionRouter = Router();

// 规则 CRUD
commissionRouter.get("/rules", requireAuthWithTenant, commissionController.listCommissionRules);
commissionRouter.post("/rules", requireAuthWithTenant, commissionController.createCommissionRule);
commissionRouter.put("/rules/:id", requireAuthWithTenant, commissionController.updateCommissionRule);
commissionRouter.delete("/rules/:id", requireAuthWithTenant, commissionController.deleteCommissionRule);

// 计算引擎
commissionRouter.post("/calculate", requireAuthWithTenant, commissionController.calculateCommissions);
commissionRouter.post("/settle", requireAuthWithTenant, commissionController.settleCommissions);
commissionRouter.get("/records", requireAuthWithTenant, commissionController.listCommissionRecords);