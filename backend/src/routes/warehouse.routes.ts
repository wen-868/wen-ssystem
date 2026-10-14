import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import {
  listWarehousesHandler,
  createWarehouseHandler,
  updateWarehouseHandler,
  deleteWarehouseHandler,
} from "../controllers/admin/warehouse.controller";

export const warehouseRouter = Router();

// 仓库管理（t_store store_type=WAREHOUSE）
warehouseRouter.get("/", asyncHandler(listWarehousesHandler));
// S3-198 批B2-2（库存/追溯域）：仓库主数据写动作按台账 §三.12 建议码接线
// （新增 ⇒ inventory:create，变更/删除 ⇒ inventory:adjust）。
// 持有者（仓库种子）= STORE_MANAGER / WAREHOUSE_STAFF（inventory:*）+ SUPER_ADMIN、OPERATION_ADMIN（*）；
// 调用页 = 系统配置 SystemConfigView.vue（router/index.ts:241，roles [SUPER_ADMIN]）⇒ 页面角色 ⊆ 持有者。
warehouseRouter.post("/", requirePermission("inventory:create"), asyncHandler(createWarehouseHandler));
warehouseRouter.put("/:id", requirePermission("inventory:adjust"), asyncHandler(updateWarehouseHandler));
warehouseRouter.delete("/:id", requirePermission("inventory:adjust"), asyncHandler(deleteWarehouseHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/warehouses",
  router: warehouseRouter,
  auth: "requireAuthWithTenant",
};
