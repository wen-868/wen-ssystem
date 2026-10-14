import { Router } from "express";
import * as inventoryShareController from "../controllers/admin/inventory-share.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// ==================== 库存共享路由 ====================
export const inventoryShareRouter = Router();

inventoryShareRouter.get("/settings", inventoryShareController.getShareSetting);
// S3-198 批B2-2（库存/追溯域）：库存共享的写动作按台账 §三.12 建议码接线
// （新增共享商品 ⇒ inventory:create，设置/变更/移除 ⇒ inventory:adjust）。
// 持有者（仓库种子）= STORE_MANAGER（inventory:*）/ WAREHOUSE_STAFF（inventory:*）/ SUPER_ADMIN、OPERATION_ADMIN（*）；
// 调用页 = 库存共享设置 InventoryShareConfig.vue（router/index.ts:141，roles [SUPER_ADMIN]）⇒ 页面角色 ⊆ 持有者。
inventoryShareRouter.put("/settings", requirePermission("inventory:adjust"), inventoryShareController.updateShareSetting);
inventoryShareRouter.get("/products", inventoryShareController.listShareProducts);
inventoryShareRouter.post("/products", requirePermission("inventory:create"), inventoryShareController.addShareProduct);
inventoryShareRouter.post("/products/batch-add", requirePermission("inventory:create"), inventoryShareController.batchAddShareProducts);
inventoryShareRouter.post("/products/batch-remove", requirePermission("inventory:create"), inventoryShareController.batchRemoveShareProducts);
inventoryShareRouter.put("/products/:id", requirePermission("inventory:adjust"), inventoryShareController.updateShareProduct);
inventoryShareRouter.delete("/products/:id", requirePermission("inventory:adjust"), inventoryShareController.removeShareProduct);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory-share",
  router: inventoryShareRouter,
  auth: "requireAuthWithTenant",
};
