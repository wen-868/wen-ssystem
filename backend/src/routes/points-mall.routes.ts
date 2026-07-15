import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/points-mall.controller";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", requireAuthWithTenant, asyncHandler(controller.getPointsMallItems));
pointsMallRouter.post("/items", requireAuthWithTenant, asyncHandler(controller.createPointsMallItem));
pointsMallRouter.put("/items/:id", requireAuthWithTenant, asyncHandler(controller.updatePointsMallItem));
pointsMallRouter.delete("/items/:id", requireAuthWithTenant, asyncHandler(controller.deletePointsMallItem));
pointsMallRouter.put("/items/:id/status", requireAuthWithTenant, asyncHandler(controller.updatePointsMallItemStatus));
// 积分兑换订单
pointsMallRouter.get("/orders", requireAuthWithTenant, asyncHandler(controller.getPointsMallOrders));
pointsMallRouter.put("/orders/:id/deliver", requireAuthWithTenant, asyncHandler(controller.deliverPointsMallOrder));
pointsMallRouter.put("/orders/:id/cancel", requireAuthWithTenant, asyncHandler(controller.cancelPointsMallOrder));

export const routeConfig: RouteConfig = {
  prefix: "/api/points-mall",
  router: pointsMallRouter,
  auth: "requireAuthWithTenant",
};
