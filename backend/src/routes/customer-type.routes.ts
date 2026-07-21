import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/customer-type.controller";

export const customerTypeRouter = Router();

customerTypeRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listCustomerTypes));
customerTypeRouter.get("/:id", requireAuthWithTenant, asyncHandler(controller.getCustomerType));
customerTypeRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createCustomerType));
customerTypeRouter.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateCustomerType));
customerTypeRouter.delete("/:id", requireAuthWithTenant, asyncHandler(controller.deleteCustomerType));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/customer-types",
    router: customerTypeRouter,
    auth: "requireAuthWithTenant",
};
