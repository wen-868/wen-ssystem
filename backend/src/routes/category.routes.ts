import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

import { listCategories, createCategory, updateCategory, deleteCategory, sortCategory } from "../controllers/admin/category.controller";

export const categoryRouter = Router();

categoryRouter.get("/", asyncHandler(listCategories));
categoryRouter.post("/", asyncHandler(createCategory));
categoryRouter.put("/:id", asyncHandler(updateCategory));
categoryRouter.delete("/:id", asyncHandler(deleteCategory));
categoryRouter.put("/:id/sort", asyncHandler(sortCategory));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/products/categories",
  router: categoryRouter,
  auth: "requireAuthWithTenant",
};
