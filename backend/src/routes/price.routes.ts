import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { requirePriceManagementAccess, requirePriceChangeLogAccess, priceResponseFilter } from "../shared/price-guard-middleware.js";
import * as priceLevelController from "../controllers/admin/price-level.controller.js";
import * as priceManagementController from "../controllers/admin/price-management.controller.js";
import * as batchPriceController from "../controllers/admin/batch-price.controller.js";

export const priceRouter = Router();

// 价格等级管理 - 仅管理员/店长可操作
priceRouter.get("/levels", requireAuthWithTenant, priceLevelController.listPriceLevels);
priceRouter.post("/levels", requireAuthWithTenant, priceLevelController.createPriceLevel);
priceRouter.put("/levels/:id", requireAuthWithTenant, priceLevelController.updatePriceLevel);
priceRouter.delete("/levels/:id", requireAuthWithTenant, priceLevelController.disablePriceLevel);

// 阶梯价格管理 - 仅管理员/店长可操作
priceRouter.get("/skus/:skuId/prices", requireAuthWithTenant, priceManagementController.listSkuPrices);
priceRouter.post("/skus/:skuId/prices", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.setSkuPrices);
priceRouter.put("/prices/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.updateSkuPrice);
priceRouter.delete("/prices/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.deleteSkuPrice);

// 最优价查询
priceRouter.post("/best-price", requireAuthWithTenant, priceManagementController.getBestPrice);

// 客户价格绑定 - 仅管理员/店长可操作
priceRouter.get("/customer-bindings", requireAuthWithTenant, priceManagementController.listCustomerBindings);
priceRouter.post("/customer-bindings", requireAuthWithTenant, priceManagementController.createCustomerBinding);
priceRouter.put("/customer-bindings/:id/approve", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.approveCustomerBinding);
priceRouter.put("/customer-bindings/:id/reject", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.rejectCustomerBinding);
priceRouter.delete("/customer-bindings/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.cancelCustomerBinding);

// 价格变更日志 - 仅管理员/店长/财务可查看
priceRouter.get("/change-logs", requireAuthWithTenant, requirePriceChangeLogAccess(), priceManagementController.listChangeLogs);

// 批量价格调整 - 仅管理员/店长可操作
priceRouter.post("/batch/preview", requireAuthWithTenant, requirePriceManagementAccess(), batchPriceController.previewBatchAdjustment);
priceRouter.post("/batch/execute", requireAuthWithTenant, requirePriceManagementAccess(), batchPriceController.executeBatchAdjustment);
priceRouter.get("/batch/logs", requireAuthWithTenant, requirePriceChangeLogAccess(), batchPriceController.listBatchLogs);
priceRouter.get("/batch/:batchNo", requireAuthWithTenant, requirePriceChangeLogAccess(), batchPriceController.getBatchDetail);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/prices",
  router: priceRouter,
  auth: "requireAuthWithTenant",
};
