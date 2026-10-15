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
// S3-224（第 43 项 B2 批 6 · 销售域接线）：本文件 3 条按「使用者已持有的最细现成码」接线——
// `sale:edit`（批量改状态 / 改备注）与 `sale:void`（订单取消）。生产持有（12 角色复算，见
// docs/evidence/S3-224/05-prod-holders.txt）：sale:edit / sale:void = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER；
// 三条**全仓无页面调用点**（app-mobile orders.ts 仅有封装、无页面使用），故接线不误伤任何现有页面。
// ⚠️ 同文件 `PUT /orders/:orderNo/status` 本批**不接**（app-mobile 有写调用点且使用者集合不可枚举，B 类）。
// 2026-10-16
adminOrderRouter.post("/orders/batch-status", requirePermission("sale:edit"), orderController.batchUpdateOrderStatus);
adminOrderRouter.get("/orders/:orderNo", orderController.getOrderDetail);
adminOrderRouter.post("/orders/:orderNo/cancel", requirePermission("sale:void"), orderController.cancelOrder);
adminOrderRouter.put("/orders/:orderNo/remark", requirePermission("sale:edit"), orderController.remarkOrder);
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
