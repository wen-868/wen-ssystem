import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as orderController from "../controllers/admin/order.controller.js";

export const adminOrderRouter = Router();

// ============ 订单管理 ============
adminOrderRouter.get("/orders", requireAuthWithTenant, orderController.listOrders);
adminOrderRouter.get("/orders/export-csv", requireAuthWithTenant, orderController.exportOrdersCsv);
adminOrderRouter.get("/orders/stats", requireAuthWithTenant, orderController.getOrderStatusStats);
adminOrderRouter.post("/orders/batch-status", requireAuthWithTenant, orderController.batchUpdateOrderStatus);
adminOrderRouter.get("/orders/:orderNo", requireAuthWithTenant, orderController.getOrderDetail);
adminOrderRouter.post("/orders/:orderNo/cancel", requireAuthWithTenant, orderController.cancelOrder);
adminOrderRouter.put("/orders/:orderNo/remark", requireAuthWithTenant, orderController.remarkOrder);
adminOrderRouter.put("/orders/:orderNo/status", requireAuthWithTenant, orderController.updateOrderStatus);
adminOrderRouter.get("/orders/:orderNo/logs", requireAuthWithTenant, orderController.getOrderOperationLogs);

// ============ 销售单管理 ============
adminOrderRouter.get("/sale-bills", requireAuthWithTenant, orderController.listSaleBills);
adminOrderRouter.get("/sale-bills/export-csv", requireAuthWithTenant, orderController.exportSaleBillsCsv);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminOrderRouter,
  auth: "none",
};