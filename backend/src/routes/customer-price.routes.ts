import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as customerPriceController from "../controllers/admin/customer-price.controller";

export const customerPriceRouter = Router();

customerPriceRouter.get("/", customerPriceController.listCustomerPrices);
customerPriceRouter.post("/", customerPriceController.createCustomerPrice);
customerPriceRouter.put("/:id", customerPriceController.updateCustomerPrice);
customerPriceRouter.delete("/:id", customerPriceController.deleteCustomerPrice);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-prices",
  router: customerPriceRouter,
  auth: "requireAuthWithTenant",
};
