import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import { requirePriceManagementAccess, requirePriceChangeLogAccess, priceResponseFilter } from "../shared/price-guard-middleware.js";
import * as priceLevelController from "../controllers/admin/price-level.controller.js";
import * as priceManagementController from "../controllers/admin/price-management.controller.js";

export const priceRouter = Router();

// 价格等级管理 - 仅管理员/店长可操作
priceRouter.get("/levels", requireAuthWithTenant, priceLevelController.listPriceLevels);
priceRouter.post("/levels", requireAuthWithTenant, requirePriceManagementAccess(), priceLevelController.createPriceLevel);
priceRouter.put("/levels/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceLevelController.updatePriceLevel);
priceRouter.delete("/levels/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceLevelController.disablePriceLevel);

// SKU阶梯价格 - 查询自动过滤敏感字段，修改仅管理员/店长
priceRouter.get("/skus/:skuId/prices", requireAuthWithTenant, priceResponseFilter(), priceManagementController.listSkuPrices);
priceRouter.post("/skus/:skuId/prices", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.setSkuPrices);
priceRouter.put("/prices/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.updateSkuPrice);
priceRouter.delete("/prices/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.deleteSkuPrice);
priceRouter.post("/best-price", requireAuthWithTenant, priceResponseFilter(), priceManagementController.getBestPrice);

// 客户价格绑定 - 查询自动过滤，审批仅管理员/店长
priceRouter.get("/customer-bindings", requireAuthWithTenant, priceResponseFilter(), priceManagementController.listCustomerBindings);
priceRouter.post("/customer-bindings", requireAuthWithTenant, priceManagementController.createCustomerBinding);
priceRouter.put("/customer-bindings/:id/approve", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.approveCustomerBinding);
priceRouter.put("/customer-bindings/:id/reject", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.rejectCustomerBinding);
priceRouter.delete("/customer-bindings/:id", requireAuthWithTenant, requirePriceManagementAccess(), priceManagementController.cancelCustomerBinding);

// 价格变更日志 - 仅管理员/店长/财务可查看
priceRouter.get("/change-logs", requireAuthWithTenant, requirePriceChangeLogAccess(), priceManagementController.listChangeLogs);
