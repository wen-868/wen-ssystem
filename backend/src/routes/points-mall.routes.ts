import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/points-mall.controller";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", asyncHandler(controller.getPointsMallItems));
pointsMallRouter.post("/items", asyncHandler(controller.createPointsMallItem));
pointsMallRouter.put("/items/:id", asyncHandler(controller.updatePointsMallItem));
pointsMallRouter.delete("/items/:id", asyncHandler(controller.deletePointsMallItem));
pointsMallRouter.put("/items/:id/status", asyncHandler(controller.updatePointsMallItemStatus));
// 积分兑换订单
pointsMallRouter.get("/orders", asyncHandler(controller.getPointsMallOrders));
pointsMallRouter.put("/orders/:id/deliver", asyncHandler(controller.deliverPointsMallOrder));
pointsMallRouter.put("/orders/:id/cancel", asyncHandler(controller.cancelPointsMallOrder));

export const routeConfig: RouteConfig = {
  prefix: "/api/points-mall",
  router: pointsMallRouter,
  auth: "requireAuthWithTenant",
};
