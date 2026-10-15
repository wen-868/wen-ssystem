import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";

import { listUnits, createUnit, updateUnit, deleteUnit } from "../controllers/admin/unit.controller";

export const unitRouter = Router();

// S3-220（商品域接线 · B2 批 3）：以下 3 行挂**既有**码 goods:create|edit|delete。
// 全仓无页面调用点（`/admin/units` 只有 GET 被用；单位管理页 `Units.vue` 的增删改打的是
// `/admin/unit-groups`）⇒ 接线零回归；判定见缺口清单 §十二。
unitRouter.get("/", asyncHandler(listUnits));
unitRouter.post("/", requirePermission("goods:create"), asyncHandler(createUnit));
unitRouter.put("/:id", requirePermission("goods:edit"), asyncHandler(updateUnit));
unitRouter.delete("/:id", requirePermission("goods:delete"), asyncHandler(deleteUnit));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/units",
  router: unitRouter,
  auth: "requireAuthWithTenant",
};
