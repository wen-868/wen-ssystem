import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as priceLevelController from "../controllers/admin/price-level.controller.js";
import * as priceManagementController from "../controllers/admin/price-management.controller.js";

export const priceRouter = Router();

priceRouter.get("/levels", requireAuthWithTenant, priceLevelController.listPriceLevels);
priceRouter.post("/levels", requireAuthWithTenant, priceLevelController.createPriceLevel);
priceRouter.put("/levels/:id", requireAuthWithTenant, priceLevelController.updatePriceLevel);
priceRouter.delete("/levels/:id", requireAuthWithTenant, priceLevelController.disablePriceLevel);

priceRouter.get("/skus/:skuId/prices", requireAuthWithTenant, priceManagementController.listSkuPrices);
priceRouter.post("/skus/:skuId/prices", requireAuthWithTenant, priceManagementController.setSkuPrices);
priceRouter.put("/prices/:id", requireAuthWithTenant, priceManagementController.updateSkuPrice);
priceRouter.delete("/prices/:id", requireAuthWithTenant, priceManagementController.deleteSkuPrice);
priceRouter.post("/best-price", requireAuthWithTenant, priceManagementController.getBestPrice);

priceRouter.get("/customer-bindings", requireAuthWithTenant, priceManagementController.listCustomerBindings);
priceRouter.post("/customer-bindings", requireAuthWithTenant, priceManagementController.createCustomerBinding);
priceRouter.put("/customer-bindings/:id/approve", requireAuthWithTenant, priceManagementController.approveCustomerBinding);
priceRouter.put("/customer-bindings/:id/reject", requireAuthWithTenant, priceManagementController.rejectCustomerBinding);
priceRouter.delete("/customer-bindings/:id", requireAuthWithTenant, priceManagementController.cancelCustomerBinding);

priceRouter.get("/change-logs", requireAuthWithTenant, priceManagementController.listChangeLogs);
