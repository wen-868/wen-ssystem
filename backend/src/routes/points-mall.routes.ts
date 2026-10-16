import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/points-mall.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", asyncHandler(controller.getPointsMallItems));
// S3-226（第 43 项 B2 批 8 · 营销域接线）：`/api/points-mall` 6 条写端点挂 `marketing:points`（台账 §三.4 域内建议码）。
// 依据：admin-web `api/marketing.ts:308/309/310/312` 打的是 `/admin/points-mall/*`（**后端前缀是 `/api/points-mall`**，
// 路径错配 ⇒ 调用即 404；`deliver` 的方法亦不一致：前端 POST / 后端 PUT）⇒ 全仓**无有效调用点**；
// 使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归。
pointsMallRouter.post("/items", requirePermission("marketing:points"), asyncHandler(controller.createPointsMallItem));
pointsMallRouter.put("/items/:id", requirePermission("marketing:points"), asyncHandler(controller.updatePointsMallItem));
pointsMallRouter.delete("/items/:id", requirePermission("marketing:points"), asyncHandler(controller.deletePointsMallItem));
pointsMallRouter.put("/items/:id/status", requirePermission("marketing:points"), asyncHandler(controller.updatePointsMallItemStatus));
// 积分兑换订单
pointsMallRouter.get("/orders", asyncHandler(controller.getPointsMallOrders));
pointsMallRouter.put("/orders/:id/deliver", requirePermission("marketing:points"), asyncHandler(controller.deliverPointsMallOrder));
pointsMallRouter.put("/orders/:id/cancel", requirePermission("marketing:points"), asyncHandler(controller.cancelPointsMallOrder));

export const routeConfig: RouteConfig = {
  prefix: "/api/points-mall",
  router: pointsMallRouter,
  auth: "requireAuthWithTenant",
};
