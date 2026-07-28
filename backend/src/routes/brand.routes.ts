import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

import { listBrands, createBrand, updateBrand, deleteBrand } from "../controllers/admin/brand.controller";

export const brandRouter = Router();

brandRouter.get("/", asyncHandler(listBrands));
brandRouter.post("/", asyncHandler(createBrand));
brandRouter.put("/:id", asyncHandler(updateBrand));
brandRouter.delete("/:id", asyncHandler(deleteBrand));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/brands",
  router: brandRouter,
  auth: "requireAuthWithTenant",
};
