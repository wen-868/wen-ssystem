import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  listWarehousesHandler,
  createWarehouseHandler,
  updateWarehouseHandler,
  deleteWarehouseHandler,
} from "../controllers/admin/warehouse.controller";

export const warehouseRouter = Router();

// 仓库管理（t_store store_type=WAREHOUSE）
warehouseRouter.get("/", asyncHandler(listWarehousesHandler));
warehouseRouter.post("/", asyncHandler(createWarehouseHandler));
warehouseRouter.put("/:id", asyncHandler(updateWarehouseHandler));
warehouseRouter.delete("/:id", asyncHandler(deleteWarehouseHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/warehouses",
  router: warehouseRouter,
  auth: "requireAuthWithTenant",
};
