import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as inventoryShareController from "../controllers/admin/inventory-share.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 库存共享路由 ====================
export const inventoryShareRouter = Router();

inventoryShareRouter.get("/settings", requireAuthWithTenant, inventoryShareController.getShareSetting);
inventoryShareRouter.put("/settings", requireAuthWithTenant, inventoryShareController.updateShareSetting);
inventoryShareRouter.get("/products", requireAuthWithTenant, inventoryShareController.listShareProducts);
inventoryShareRouter.post("/products", requireAuthWithTenant, inventoryShareController.addShareProduct);
inventoryShareRouter.post("/products/batch-add", requireAuthWithTenant, inventoryShareController.batchAddShareProducts);
inventoryShareRouter.post("/products/batch-remove", requireAuthWithTenant, inventoryShareController.batchRemoveShareProducts);
inventoryShareRouter.put("/products/:id", requireAuthWithTenant, inventoryShareController.updateShareProduct);
inventoryShareRouter.delete("/products/:id", requireAuthWithTenant, inventoryShareController.removeShareProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory-share",
  router: inventoryShareRouter,
  auth: "requireAuthWithTenant",
};
