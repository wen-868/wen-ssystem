import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as customerPriceController from "../controllers/admin/customer-price.controller.js";

export const customerPriceRouter = Router();

customerPriceRouter.get("/", requireAuthWithTenant, customerPriceController.listCustomerPrices);
customerPriceRouter.post("/", requireAuthWithTenant, customerPriceController.createCustomerPrice);
customerPriceRouter.put("/:id", requireAuthWithTenant, customerPriceController.updateCustomerPrice);
customerPriceRouter.delete("/:id", requireAuthWithTenant, customerPriceController.deleteCustomerPrice);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-prices",
  router: customerPriceRouter,
  auth: "requireAuthWithTenant",
};
