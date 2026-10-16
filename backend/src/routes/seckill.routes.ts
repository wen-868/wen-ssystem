import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/seckill.controller";
import { requirePermission } from "../middleware/rbac-auth";

export const seckillRouter = Router();

seckillRouter.get("/", asyncHandler(controller.getSeckillProducts));
// S3-226（第 43 项 B2 批 8 · 营销域接线）：`/api/seckill` 3 条写端点挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `api/marketing.ts:294/295/296` 打的是 `/admin/marketing/seckill*`（**后端前缀是 `/api/seckill`**，
// 路径错配 ⇒ 调用即 404；秒杀活动页真实用的是 `admin-marketing-flash-sale.routes.ts`）⇒ 全仓**无有效调用点**；
// 使用者集合 ⊆ {SUPER_ADMIN, OPERATION_ADMIN} ⇒ 零回归（app-mobile 打的是 `/api/marketing/seckill/*`，另一套前缀）。
seckillRouter.post("/", requirePermission("marketing:create"), asyncHandler(controller.createSeckillProduct));
seckillRouter.put("/:id", requirePermission("marketing:create"), asyncHandler(controller.updateSeckillProduct));
seckillRouter.delete("/:id", requirePermission("marketing:create"), asyncHandler(controller.deleteSeckillProduct));

export const routeConfig: RouteConfig = {
  prefix: "/api/seckill",
  router: seckillRouter,
  auth: "requireAuthWithTenant",
};
