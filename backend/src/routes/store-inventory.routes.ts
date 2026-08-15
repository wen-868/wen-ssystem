import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as inventoryController from "../controllers/store/inventory.controller";

export const storeInventoryRouter = Router();

// 库存
storeInventoryRouter.get("/inventory", inventoryController.listInventory);
storeInventoryRouter.post("/inventory/adjust", inventoryController.adjustInventory);
storeInventoryRouter.get("/inventory/logs", inventoryController.listInventoryLogs);
storeInventoryRouter.get("/inventory/alerts", inventoryController.listInventoryAlerts);
storeInventoryRouter.put("/inventory/alerts/:skuId/threshold", inventoryController.updateAlertThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeInventoryRouter,
  auth: "requireAuthWithTenant",
};
