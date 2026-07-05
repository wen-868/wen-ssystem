import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as inventoryController from "../controllers/store/inventory.controller.js";

export const storeInventoryRouter = Router();

storeInventoryRouter.use(requireAuthWithTenant);

// 库存
storeInventoryRouter.get("/inventory", inventoryController.listInventory);
storeInventoryRouter.post("/inventory/adjust", inventoryController.adjustInventory);
storeInventoryRouter.get("/inventory/logs", inventoryController.listInventoryLogs);
storeInventoryRouter.get("/inventory/alerts", inventoryController.listInventoryAlerts);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeInventoryRouter,
  auth: "none",
};