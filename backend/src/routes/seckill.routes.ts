import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/seckill.controller";

export const seckillRouter = Router();

seckillRouter.get("/", requireAuthWithTenant, asyncHandler(controller.getSeckillProducts));
seckillRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createSeckillProduct));
seckillRouter.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateSeckillProduct));
seckillRouter.delete("/:id", requireAuthWithTenant, asyncHandler(controller.deleteSeckillProduct));
