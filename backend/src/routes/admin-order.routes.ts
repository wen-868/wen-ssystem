import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { priceResponseFilter } from "../middleware/price-guard";
import { requirePermission } from "../middleware/rbac-auth";
import { PERM_SALE_CANCEL } from "../shared/sale-permission-codes";
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
// S3-209（跨线 P1，AI 底座 cancelSalesOrder 的唯一阻塞项）：销售单取消。
// 权限点 `sale:cancel` 为**本单新立**（079 权限矩阵只有 sale:void/edit/create）⇒ 见
// shared/sale-permission-codes.ts 与 docs/migrations/203_销售单取消权限点.sql。
// 持有者：SUPER_ADMIN（`*`）/ STORE_MANAGER（`sale:*` 域通配）⇒ 店长可取消，符合业务口径。
adminOrderRouter.post("/sale-bills/:billNo/cancel", requirePermission(PERM_SALE_CANCEL), orderController.cancelSaleBill);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminOrderRouter,
  auth: "requireAuthWithTenant",
};
