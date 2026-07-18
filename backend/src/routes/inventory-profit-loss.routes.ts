import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as inventoryLossOrderController from "../controllers/admin/inventory-loss-order.controller";
import * as inventoryProfitOrderController from "../controllers/admin/inventory-profit-order.controller";
import * as profitLossStatsController from "../controllers/admin/profit-loss-stats.controller";

export const inventoryProfitLossRouter = Router();

// ============ 报损单管理 ============
inventoryProfitLossRouter.get("/loss-orders", requireAuthWithTenant, inventoryLossOrderController.listLossOrders);
inventoryProfitLossRouter.get("/loss-orders/:id", requireAuthWithTenant, inventoryLossOrderController.getLossOrderDetail);
inventoryProfitLossRouter.post("/loss-orders", requireAuthWithTenant, inventoryLossOrderController.createLossOrder);
inventoryProfitLossRouter.post("/loss-orders/:id/approve", requireAuthWithTenant, inventoryLossOrderController.approveLossOrder);
inventoryProfitLossRouter.post("/loss-orders/:id/reject", requireAuthWithTenant, inventoryLossOrderController.rejectLossOrder);

// ============ 报溢单管理 ============
inventoryProfitLossRouter.get("/profit-orders", requireAuthWithTenant, inventoryProfitOrderController.listProfitOrders);
inventoryProfitLossRouter.get("/profit-orders/:id", requireAuthWithTenant, inventoryProfitOrderController.getProfitOrderDetail);
inventoryProfitLossRouter.post("/profit-orders", requireAuthWithTenant, inventoryProfitOrderController.createProfitOrder);
inventoryProfitLossRouter.post("/profit-orders/:id/approve", requireAuthWithTenant, inventoryProfitOrderController.approveProfitOrder);
inventoryProfitLossRouter.post("/profit-orders/:id/reject", requireAuthWithTenant, inventoryProfitOrderController.rejectProfitOrder);

// ============ 损益统计 ============
inventoryProfitLossRouter.get("/profit-loss/stats", requireAuthWithTenant, profitLossStatsController.getProfitLossStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryProfitLossRouter,
  auth: "requireAuthWithTenant",
};
