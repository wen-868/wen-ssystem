import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";

import { createCategory, updateCategory, deleteCategory, sortCategory } from "../controllers/admin/category.controller";

export const categoryRouter = Router();

// GET /api/admin/products/categories：S3-179 删除死代码。
// 该完整路径由 admin-product.routes.ts:32（prefix "/api/admin" + "/products/categories"）唯一提供，
// 且该文件按文件名排序先注册（"admin-product…" < "category…"）⇒ 这里原来的 get("/") 永不执行。
// admin-product.routes.ts:31 的注释已说明它必须排在 /products/:spuId 之前，故保留那边、删这边。
// S3-233（B 类收编第一批 · 商品域）：商品分类写端点按 3 道门收编（permission-gates.ts）——
//   · `goods-category-create`（分类页「新增分类」）⇒ `goods:create`
//   · `goods-category-edit`（分类编辑页「保存」+「编辑/排序」）⇒ `goods:edit`
//   · `goods-category-delete`（分类页「删除」）⇒ `goods:delete`
// 与同域既有码同源（`079_权限矩阵.sql:201-203`）；S3-220 §十二 的「B 类 13 条」中本文件 4 行由此收编。
// 注意：分类**页**菜单码 `goods:category` 在生产授予 7 个角色（其中 6 个不持 `goods:*`）⇒ 本批只门**写端点**、
// 不门页面读取（S3-230 的门亦只作用于写按钮），读能力保持不变。
categoryRouter.post("/", requirePermission("goods:create"), asyncHandler(createCategory));
categoryRouter.put("/:id", requirePermission("goods:edit"), asyncHandler(updateCategory));
categoryRouter.delete("/:id", requirePermission("goods:delete"), asyncHandler(deleteCategory));
categoryRouter.put("/:id/sort", requirePermission("goods:edit"), asyncHandler(sortCategory));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/products/categories",
  router: categoryRouter,
  auth: "requireAuthWithTenant",
};
