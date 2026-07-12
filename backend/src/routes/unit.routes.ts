import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import { listUnits, createUnit, updateUnit, deleteUnit } from "../controllers/admin/unit.controller";

export const unitRouter = Router();

unitRouter.get("/", requireAuthWithTenant, asyncHandler(listUnits));
unitRouter.post("/", requireAuthWithTenant, asyncHandler(createUnit));
unitRouter.put("/:id", requireAuthWithTenant, asyncHandler(updateUnit));
unitRouter.delete("/:id", requireAuthWithTenant, asyncHandler(deleteUnit));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/units",
  router: unitRouter,
  auth: "requireAuthWithTenant",
};
