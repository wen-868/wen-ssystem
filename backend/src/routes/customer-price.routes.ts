import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 = 台账 §三.2 建议码；页面 `sales/customer-prices`
//（router/index.ts:111，roles = SUPER_ADMIN + STORE_MANAGER）两者均持有 `customer:*` ⇒ 零回归。
import { requirePermission } from "../middleware/rbac-auth";

import * as customerPriceController from "../controllers/admin/customer-price.controller";

export const customerPriceRouter = Router();

customerPriceRouter.get("/", customerPriceController.listCustomerPrices);
customerPriceRouter.post("/", requirePermission("customer:create"), customerPriceController.createCustomerPrice);
customerPriceRouter.put("/:id", requirePermission("customer:edit"), customerPriceController.updateCustomerPrice);
customerPriceRouter.delete("/:id", requirePermission("customer:edit"), customerPriceController.deleteCustomerPrice);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-prices",
  router: customerPriceRouter,
  auth: "requireAuthWithTenant",
};
