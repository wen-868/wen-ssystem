import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

import { createCategory, updateCategory, deleteCategory, sortCategory } from "../controllers/admin/category.controller";

export const categoryRouter = Router();

// GET /api/admin/products/categories：S3-179 删除死代码。
// 该完整路径由 admin-product.routes.ts:32（prefix "/api/admin" + "/products/categories"）唯一提供，
// 且该文件按文件名排序先注册（"admin-product…" < "category…"）⇒ 这里原来的 get("/") 永不执行。
// admin-product.routes.ts:31 的注释已说明它必须排在 /products/:spuId 之前，故保留那边、删这边。
categoryRouter.post("/", asyncHandler(createCategory));
categoryRouter.put("/:id", asyncHandler(updateCategory));
categoryRouter.delete("/:id", asyncHandler(deleteCategory));
categoryRouter.put("/:id/sort", asyncHandler(sortCategory));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/products/categories",
  router: categoryRouter,
  auth: "requireAuthWithTenant",
};
