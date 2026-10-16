import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import { listUnitGroups, getUnitGroup, createUnitGroup, updateUnitGroup, deleteUnitGroup } from "../controllers/admin/unit-group.controller";

export const unitGroupRouter = Router();

unitGroupRouter.get("/", asyncHandler(listUnitGroups));
unitGroupRouter.get("/:id", asyncHandler(getUnitGroup));
// S3-237（接线批 10 · 组 2「商品 A 类」）：2 行挂**既有**码 `goods:create` / `goods:edit`
// （`docs/migrations/079_权限矩阵.sql:200-201`）。页面 = `admin-web/src/views/product/Units.vue`
// （`router/index.ts:168`，`meta.roles` = [SUPER_ADMIN, **STORE_MANAGER**]）⇒ 店长经 **D1**
// （迁移 204 补 `goods:create|edit`，生产已复核）持有 ⇒ 无 403 回归。
unitGroupRouter.post("/", requirePermission("goods:create"), asyncHandler(createUnitGroup));
unitGroupRouter.put("/:id", requirePermission("goods:edit"), asyncHandler(updateUnitGroup));
// ⚠️ S3-237 本批**不接** `DELETE /:id`：D1 未授予店长 `goods:delete`（高风险）⇒ 挂码即把 `Units.vue:223/235`
//   的店长打成 403，按 D4「前端补门」处置，只登记、交凌舟另立前端小单。
unitGroupRouter.delete("/:id", asyncHandler(deleteUnitGroup));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/unit-groups",
  router: unitGroupRouter,
  auth: "requireAuthWithTenant",
};
