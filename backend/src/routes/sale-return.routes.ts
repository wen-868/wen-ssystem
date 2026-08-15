import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/sale-return.controller";

export const saleReturnRouter = Router();

saleReturnRouter.get("/", asyncHandler(controller.listSaleReturns));
saleReturnRouter.get("/:returnNo", asyncHandler(controller.getSaleReturnDetail));
saleReturnRouter.post("/", asyncHandler(controller.createSaleReturn));
saleReturnRouter.post("/:returnNo/approve", asyncHandler(controller.approveSaleReturn));
saleReturnRouter.post("/:returnNo/reject", asyncHandler(controller.rejectSaleReturn));
saleReturnRouter.post("/:returnNo/refund", asyncHandler(controller.refundSaleReturn));
saleReturnRouter.get("/sale-bills/:billNo", asyncHandler(controller.getSaleBillForReturn));

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/admin/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
];
