import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/sale-return.controller";

export const saleReturnRouter = Router();

saleReturnRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listSaleReturns));
saleReturnRouter.get("/:returnNo", requireAuthWithTenant, asyncHandler(controller.getSaleReturnDetail));
saleReturnRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createSaleReturn));
saleReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, asyncHandler(controller.approveSaleReturn));
saleReturnRouter.post("/:returnNo/refund", requireAuthWithTenant, asyncHandler(controller.refundSaleReturn));
saleReturnRouter.get("/sale-bills/:billNo", requireAuthWithTenant, asyncHandler(controller.getSaleBillForReturn));

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/admin/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
];
