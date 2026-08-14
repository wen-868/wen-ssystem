import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as orderController from "../controllers/admin/order.controller";

export const adminOrderRouter = Router();

adminOrderRouter.use(priceResponseFilter());

// ============ 订单管理 ============
adminOrderRouter.get("/orders", orderController.listOrders);
adminOrderRouter.get("/orders/export-csv", orderController.exportOrdersCsv);
adminOrderRouter.get("/orders/stats", orderController.getOrderStatusStats);
adminOrderRouter.post("/orders/batch-status", orderController.batchUpdateOrderStatus);
adminOrderRouter.get("/orders/:orderNo", orderController.getOrderDetail);
adminOrderRouter.post("/orders/:orderNo/cancel", orderController.cancelOrder);
adminOrderRouter.put("/orders/:orderNo/remark", orderController.remarkOrder);
adminOrderRouter.put("/orders/:orderNo/status", orderController.updateOrderStatus);
adminOrderRouter.get("/orders/:orderNo/logs", orderController.getOrderOperationLogs);

// ============ 销售单管理 ============
adminOrderRouter.get("/sale-bills", orderController.listSaleBills);
adminOrderRouter.get("/sale-bills/export-csv", orderController.exportSaleBillsCsv);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminOrderRouter,
  auth: "requireAuthWithTenant",
};