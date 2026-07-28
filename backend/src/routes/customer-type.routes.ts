import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/customer-type.controller";

export const customerTypeRouter = Router();

customerTypeRouter.get("/", asyncHandler(controller.listCustomerTypes));
customerTypeRouter.get("/:id", asyncHandler(controller.getCustomerType));
customerTypeRouter.post("/", asyncHandler(controller.createCustomerType));
customerTypeRouter.put("/:id", asyncHandler(controller.updateCustomerType));
customerTypeRouter.delete("/:id", asyncHandler(controller.deleteCustomerType));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/customer-types",
    router: customerTypeRouter,
    auth: "requireAuthWithTenant",
};
