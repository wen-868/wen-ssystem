import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePriceManagementAccess, requirePriceChangeLogAccess } from "../middleware/price-guard";
import { requirePermission } from "../middleware/rbac-auth";
import * as priceLevelController from "../controllers/admin/price-level.controller";
import * as priceManagementController from "../controllers/admin/price-management.controller";
import * as batchPriceController from "../controllers/admin/batch-price.controller";
import * as priceReviewController from "../controllers/admin/price-review.controller";

export const priceRouter = Router();

// 价格等级管理 - 仅管理员/店长可操作
priceRouter.get("/levels", priceLevelController.listPriceLevels);
priceRouter.post("/levels", requirePermission("goods:price"), priceLevelController.createPriceLevel);
priceRouter.put("/levels/:id", requirePermission("goods:price"), priceLevelController.updatePriceLevel);
priceRouter.delete("/levels/:id", requirePermission("goods:price"), priceLevelController.disablePriceLevel);

// 阶梯价格管理 - 仅管理员/店长可操作
priceRouter.get("/skus/:skuId/prices", priceManagementController.listSkuPrices);
priceRouter.post("/skus/:skuId/prices", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.setSkuPrices);
priceRouter.put("/prices/:id", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.updateSkuPrice);
priceRouter.delete("/prices/:id", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.deleteSkuPrice);

// 最优价查询
// ⚠️ S3-220 **本行不接线**：`rbac-g0-wiring.test.ts:700` 已把本行列为「查询型 POST（待裁定）」并断言
//    READONLY 仍 200（`rbac-g1-wiring.test.ts:286` 同款锁定）⇒ 属**既有待裁定项**，本批不动，随回执报备。
priceRouter.post("/best-price", priceManagementController.getBestPrice);

// 客户价格绑定 - 仅管理员/店长可操作
priceRouter.get("/customer-bindings", priceManagementController.listCustomerBindings);
priceRouter.post("/customer-bindings", requirePermission("goods:price"), priceManagementController.createCustomerBinding);
priceRouter.put("/customer-bindings/:id/approve", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.approveCustomerBinding);
priceRouter.put("/customer-bindings/:id/reject", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.rejectCustomerBinding);
priceRouter.delete("/customer-bindings/:id", requirePermission("goods:price"), requirePriceManagementAccess(), priceManagementController.cancelCustomerBinding);

// 价格变更日志 - 仅管理员/店长/财务可查看
priceRouter.get("/change-logs", requirePriceChangeLogAccess(), priceManagementController.listChangeLogs);

// 批量价格调整 - 仅管理员/店长可操作
// ⚠️ S3-220 **本行不接线**：本行已有 `requirePriceManagementAccess()`（角色白名单，非裸奔），而
//    `rbac-g0-wiring.test.ts:725` 把「READONLY 调本行 ⇒ PRICE_MANAGEMENT_DENIED」列为**已知锁定**。
//    接 `goods:price` 后拦在第一层的变成 RBAC（403 文案变），属改动既有锁定行为 ⇒ 本批不动，随回执报备。
priceRouter.post("/batch/preview", requirePriceManagementAccess(), batchPriceController.previewBatchAdjustment);
priceRouter.post("/batch/execute", requirePermission("goods:price"), requirePriceManagementAccess(), batchPriceController.executeBatchAdjustment);
priceRouter.get("/batch/logs", requirePriceChangeLogAccess(), batchPriceController.listBatchLogs);
priceRouter.get("/batch/:batchNo", requirePriceChangeLogAccess(), batchPriceController.getBatchDetail);

// 建议核价 / 价格异常 - 仅管理员/店长可操作
priceRouter.post("/review", requirePermission("goods:price"), requirePriceManagementAccess(), priceReviewController.submitPriceReview);
priceRouter.get("/anomalies", requirePriceManagementAccess(), priceReviewController.listPriceAnomalies);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/prices",
  router: priceRouter,
  auth: "requireAuthWithTenant",
};
