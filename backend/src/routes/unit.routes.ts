import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

import { listUnits, createUnit, updateUnit, deleteUnit } from "../controllers/admin/unit.controller";

export const unitRouter = Router();

unitRouter.get("/", asyncHandler(listUnits));
unitRouter.post("/", asyncHandler(createUnit));
unitRouter.put("/:id", asyncHandler(updateUnit));
unitRouter.delete("/:id", asyncHandler(deleteUnit));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/units",
  router: unitRouter,
  auth: "requireAuthWithTenant",
};
