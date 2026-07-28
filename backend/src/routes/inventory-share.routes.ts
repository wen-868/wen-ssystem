import { Router } from "express";
import * as inventoryShareController from "../controllers/admin/inventory-share.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 库存共享路由 ====================
export const inventoryShareRouter = Router();

inventoryShareRouter.get("/settings", inventoryShareController.getShareSetting);
inventoryShareRouter.put("/settings", inventoryShareController.updateShareSetting);
inventoryShareRouter.get("/products", inventoryShareController.listShareProducts);
inventoryShareRouter.post("/products", inventoryShareController.addShareProduct);
inventoryShareRouter.post("/products/batch-add", inventoryShareController.batchAddShareProducts);
inventoryShareRouter.post("/products/batch-remove", inventoryShareController.batchRemoveShareProducts);
inventoryShareRouter.put("/products/:id", inventoryShareController.updateShareProduct);
inventoryShareRouter.delete("/products/:id", inventoryShareController.removeShareProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory-share",
  router: inventoryShareRouter,
  auth: "requireAuthWithTenant",
};
