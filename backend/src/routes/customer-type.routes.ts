import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 = 台账 §三.2 建议码；页面 `customer-types`
//（router/index.ts:162，roles = SUPER_ADMIN）持有 `*` ⇒ 零回归。
import { requirePermission } from "../middleware/rbac-auth";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/customer-type.controller";

export const customerTypeRouter = Router();

customerTypeRouter.get("/", asyncHandler(controller.listCustomerTypes));
customerTypeRouter.get("/:id", asyncHandler(controller.getCustomerType));
customerTypeRouter.post("/", requirePermission("customer:create"), asyncHandler(controller.createCustomerType));
customerTypeRouter.put("/:id", requirePermission("customer:edit"), asyncHandler(controller.updateCustomerType));
customerTypeRouter.delete("/:id", requirePermission("customer:edit"), asyncHandler(controller.deleteCustomerType));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/customer-types",
    router: customerTypeRouter,
    auth: "requireAuthWithTenant",
};
