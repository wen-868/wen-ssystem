import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";

import { listBrands, createBrand, updateBrand, deleteBrand } from "../controllers/admin/brand.controller";

export const brandRouter = Router();

brandRouter.get("/", asyncHandler(listBrands));
// S3-237（接线批 10 · 组 2「商品 A 类」）：2 行挂**既有**码 `goods:create` / `goods:edit`
// （`docs/migrations/079_权限矩阵.sql:200-201`）。页面 = `admin-web/src/views/product/Brands.vue`
// （`router/index.ts:167`，`meta.roles` = [SUPER_ADMIN, **STORE_MANAGER**]）⇒ 店长经 **D1**
// （迁移 204 给 `STORE_MANAGER` 补 `goods:create|edit`，生产已复核 9 → 11 项）持有 ⇒ 无 403 回归。
brandRouter.post("/", requirePermission("goods:create"), asyncHandler(createBrand));
brandRouter.put("/:id", requirePermission("goods:edit"), asyncHandler(updateBrand));
// ⚠️ S3-237 本批**不接** `DELETE /:id`：D1 明确不含 `goods:delete`（删除属高风险）⇒ 挂码会把页面使用者
//   店长打成 403（同页 `Brands.vue:135` 有删除调用点），按 **D4 = 前端补门** 处置，只登记、交凌舟另立前端小单。
brandRouter.delete("/:id", asyncHandler(deleteBrand));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/brands",
  router: brandRouter,
  auth: "requireAuthWithTenant",
};
