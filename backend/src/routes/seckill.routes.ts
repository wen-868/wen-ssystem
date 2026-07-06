import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok } from "../shared/response.js";
import * as seckillService from "../services/admin/seckill.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const seckillRouter = Router();

seckillRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await seckillService.getSeckillProducts((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
seckillRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await seckillService.createSeckillProduct(req.body); res.json(ok(data));
}));
seckillRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await seckillService.updateSeckillProduct(Number(req.params.id), req.body); res.json(ok(data));
}));
seckillRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await seckillService.deleteSeckillProduct(Number(req.params.id)); res.json(ok(data));
}));