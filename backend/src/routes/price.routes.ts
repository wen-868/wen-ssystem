import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePriceManagementAccess, requirePriceChangeLogAccess } from "../middleware/price-guard";
import * as priceLevelController from "../controllers/admin/price-level.controller";
import * as priceManagementController from "../controllers/admin/price-management.controller";
import * as batchPriceController from "../controllers/admin/batch-price.controller";
import * as priceReviewController from "../controllers/admin/price-review.controller";

export const priceRouter = Router();

// 价格等级管理 - 仅管理员/店长可操作
priceRouter.get("/levels", priceLevelController.listPriceLevels);
priceRouter.post("/levels", priceLevelController.createPriceLevel);
priceRouter.put("/levels/:id", priceLevelController.updatePriceLevel);
priceRouter.delete("/levels/:id", priceLevelController.disablePriceLevel);

// 阶梯价格管理 - 仅管理员/店长可操作
priceRouter.get("/skus/:skuId/prices", priceManagementController.listSkuPrices);
priceRouter.post("/skus/:skuId/prices", requirePriceManagementAccess(), priceManagementController.setSkuPrices);
priceRouter.put("/prices/:id", requirePriceManagementAccess(), priceManagementController.updateSkuPrice);
priceRouter.delete("/prices/:id", requirePriceManagementAccess(), priceManagementController.deleteSkuPrice);

// 最优价查询
priceRouter.post("/best-price", priceManagementController.getBestPrice);

// 客户价格绑定 - 仅管理员/店长可操作
priceRouter.get("/customer-bindings", priceManagementController.listCustomerBindings);
priceRouter.post("/customer-bindings", priceManagementController.createCustomerBinding);
priceRouter.put("/customer-bindings/:id/approve", requirePriceManagementAccess(), priceManagementController.approveCustomerBinding);
priceRouter.put("/customer-bindings/:id/reject", requirePriceManagementAccess(), priceManagementController.rejectCustomerBinding);
priceRouter.delete("/customer-bindings/:id", requirePriceManagementAccess(), priceManagementController.cancelCustomerBinding);

// 价格变更日志 - 仅管理员/店长/财务可查看
priceRouter.get("/change-logs", requirePriceChangeLogAccess(), priceManagementController.listChangeLogs);

// 批量价格调整 - 仅管理员/店长可操作
priceRouter.post("/batch/preview", requirePriceManagementAccess(), batchPriceController.previewBatchAdjustment);
priceRouter.post("/batch/execute", requirePriceManagementAccess(), batchPriceController.executeBatchAdjustment);
priceRouter.get("/batch/logs", requirePriceChangeLogAccess(), batchPriceController.listBatchLogs);
priceRouter.get("/batch/:batchNo", requirePriceChangeLogAccess(), batchPriceController.getBatchDetail);

// 建议核价 / 价格异常 - 仅管理员/店长可操作
priceRouter.post("/review", requirePriceManagementAccess(), priceReviewController.submitPriceReview);
priceRouter.get("/anomalies", requirePriceManagementAccess(), priceReviewController.listPriceAnomalies);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/prices",
  router: priceRouter,
  auth: "requireAuthWithTenant",
};
