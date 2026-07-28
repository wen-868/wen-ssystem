import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as commissionController from "../controllers/admin/commission.controller";

export const commissionRouter = Router();

// 规则 CRUD
commissionRouter.get("/rules", commissionController.listCommissionRules);
commissionRouter.post("/rules", commissionController.createCommissionRule);
commissionRouter.put("/rules/:id", commissionController.updateCommissionRule);
commissionRouter.delete("/rules/:id", commissionController.deleteCommissionRule);

// 计算引擎
commissionRouter.post("/calculate", commissionController.calculateCommissions);
commissionRouter.post("/settle", commissionController.settleCommissions);
commissionRouter.get("/records", commissionController.listCommissionRecords);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/commission",
  router: commissionRouter,
  auth: "requireAuthWithTenant",
};
