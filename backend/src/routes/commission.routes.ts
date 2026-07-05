import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
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
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/commission",
  router: commissionRouter,
  auth: "requireAuthWithTenant",
};
