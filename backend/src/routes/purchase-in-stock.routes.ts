import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/purchase-in-stock.controller.js";

export const purchaseInStockRouter = Router();
purchaseInStockRouter.get("/", requireAuthWithTenant, ctrl.list);
purchaseInStockRouter.get("/:stockNo", requireAuthWithTenant, ctrl.getDetail);
purchaseInStockRouter.post("/", requireAuthWithTenant, ctrl.create);
purchaseInStockRouter.post("/:stockNo/approve", requireAuthWithTenant, ctrl.approve);
purchaseInStockRouter.post("/:stockNo/void", requireAuthWithTenant, ctrl.voidStock);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-in-stocks",
  router: purchaseInStockRouter,
  auth: "requireAuthWithTenant",
};
