import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/purchase-in-stock.controller";

export const purchaseInStockRouter = Router();
purchaseInStockRouter.get("/", ctrl.list);
purchaseInStockRouter.get("/:stockNo", ctrl.getDetail);
purchaseInStockRouter.post("/", ctrl.create);
purchaseInStockRouter.post("/:stockNo/approve", ctrl.approve);
purchaseInStockRouter.post("/:stockNo/void", ctrl.voidStock);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-in-stocks",
  router: purchaseInStockRouter,
  auth: "requireAuthWithTenant",
};
