import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import { listBrands, createBrand, updateBrand, deleteBrand } from "../controllers/admin/brand.controller";

export const brandRouter = Router();

brandRouter.get("/", requireAuthWithTenant, asyncHandler(listBrands));
brandRouter.post("/", requireAuthWithTenant, asyncHandler(createBrand));
brandRouter.put("/:id", requireAuthWithTenant, asyncHandler(updateBrand));
brandRouter.delete("/:id", requireAuthWithTenant, asyncHandler(deleteBrand));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/brands",
  router: brandRouter,
  auth: "requireAuthWithTenant",
};
