import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as inventoryLossOrderController from "../controllers/admin/inventory-loss-order.controller";
import * as inventoryProfitOrderController from "../controllers/admin/inventory-profit-order.controller";
import * as profitLossStatsController from "../controllers/admin/profit-loss-stats.controller";

export const inventoryProfitLossRouter = Router();

// ============ 报损单管理 ============
inventoryProfitLossRouter.get("/loss-orders", inventoryLossOrderController.listLossOrders);
inventoryProfitLossRouter.get("/loss-orders/:id", inventoryLossOrderController.getLossOrderDetail);
inventoryProfitLossRouter.post("/loss-orders", inventoryLossOrderController.createLossOrder);
inventoryProfitLossRouter.post("/loss-orders/:id/approve", inventoryLossOrderController.approveLossOrder);
inventoryProfitLossRouter.post("/loss-orders/:id/reject", inventoryLossOrderController.rejectLossOrder);

// ============ 报溢单管理 ============
inventoryProfitLossRouter.get("/profit-orders", inventoryProfitOrderController.listProfitOrders);
inventoryProfitLossRouter.get("/profit-orders/:id", inventoryProfitOrderController.getProfitOrderDetail);
inventoryProfitLossRouter.post("/profit-orders", inventoryProfitOrderController.createProfitOrder);
inventoryProfitLossRouter.post("/profit-orders/:id/approve", inventoryProfitOrderController.approveProfitOrder);
inventoryProfitLossRouter.post("/profit-orders/:id/reject", inventoryProfitOrderController.rejectProfitOrder);

// ============ 损益统计 ============
inventoryProfitLossRouter.get("/profit-loss/stats", profitLossStatsController.getProfitLossStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryProfitLossRouter,
  auth: "requireAuthWithTenant",
};
