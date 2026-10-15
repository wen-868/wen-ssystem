import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-in-stock.controller";

export const purchaseInStockRouter = Router();
purchaseInStockRouter.get("/", ctrl.list);
purchaseInStockRouter.get("/:stockNo", ctrl.getDetail);
// ⚠️ S3-214-B2 **本行不接线**：移动端「销售开单」采购页签无权限门 ⇒ 同 purchase.routes.ts 说明。
purchaseInStockRouter.post("/", ctrl.create);
purchaseInStockRouter.post("/:stockNo/approve", requirePermission("inventory:inbound"), ctrl.approve);
purchaseInStockRouter.post("/:stockNo/void", requirePermission("inventory:inbound"), ctrl.voidStock);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-in-stocks",
  router: purchaseInStockRouter,
  auth: "requireAuthWithTenant",
};
