import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/seckill.controller";

export const seckillRouter = Router();

seckillRouter.get("/", asyncHandler(controller.getSeckillProducts));
seckillRouter.post("/", asyncHandler(controller.createSeckillProduct));
seckillRouter.put("/:id", asyncHandler(controller.updateSeckillProduct));
seckillRouter.delete("/:id", asyncHandler(controller.deleteSeckillProduct));

export const routeConfig: RouteConfig = {
  prefix: "/api/seckill",
  router: seckillRouter,
  auth: "requireAuthWithTenant",
};
