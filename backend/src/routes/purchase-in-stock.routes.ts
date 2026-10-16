import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-in-stock.controller";

export const purchaseInStockRouter = Router();
purchaseInStockRouter.get("/", ctrl.list);
purchaseInStockRouter.get("/:stockNo", ctrl.getDetail);
// S3-233（B 类收编第一批 · 采购域）：创建采购入库单挂 `inventory:inbound`（同文件 approve / void 同码，:13-14）。
// 依据门 = permission-gates.ts 的 `purchase-sub-inbound`（开单页「采购 → 采购入库」子段）与 `home-in-stock`
//（首页快捷入口「扫码入库」）——两个入口承载的**是同一条端点**，码一致（`inventory:inbound`）。
// S3-214-B2 的「无权限门」前提已由 S3-230 修复，故本行据此收编。
purchaseInStockRouter.post("/", requirePermission("inventory:inbound"), ctrl.create);
purchaseInStockRouter.post("/:stockNo/approve", requirePermission("inventory:inbound"), ctrl.approve);
purchaseInStockRouter.post("/:stockNo/void", requirePermission("inventory:inbound"), ctrl.voidStock);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-in-stocks",
  router: purchaseInStockRouter,
  auth: "requireAuthWithTenant",
};
