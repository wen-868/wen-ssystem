import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { listUnitGroups, getUnitGroup, createUnitGroup, updateUnitGroup, deleteUnitGroup } from "../controllers/admin/unit-group.controller";

export const unitGroupRouter = Router();

unitGroupRouter.get("/", asyncHandler(listUnitGroups));
unitGroupRouter.get("/:id", asyncHandler(getUnitGroup));
unitGroupRouter.post("/", asyncHandler(createUnitGroup));
unitGroupRouter.put("/:id", asyncHandler(updateUnitGroup));
unitGroupRouter.delete("/:id", asyncHandler(deleteUnitGroup));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/unit-groups",
  router: unitGroupRouter,
  auth: "requireAuthWithTenant",
};
