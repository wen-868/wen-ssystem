import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import { listCategories, createCategory, updateCategory, deleteCategory, sortCategory } from "../controllers/admin/category.controller";

export const categoryRouter = Router();

categoryRouter.get("/", requireAuthWithTenant, asyncHandler(listCategories));
categoryRouter.post("/", requireAuthWithTenant, asyncHandler(createCategory));
categoryRouter.put("/:id", requireAuthWithTenant, asyncHandler(updateCategory));
categoryRouter.delete("/:id", requireAuthWithTenant, asyncHandler(deleteCategory));
categoryRouter.put("/:id/sort", requireAuthWithTenant, asyncHandler(sortCategory));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/products/categories",
  router: categoryRouter,
  auth: "requireAuthWithTenant",
};
