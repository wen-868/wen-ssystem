import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok } from "../shared/response.js";
import * as pointsMallService from "../services/admin/points-mall.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.getPointsMallItems((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
pointsMallRouter.post("/items", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.createPointsMallItem(req.body); res.json(ok(data));
}));
pointsMallRouter.put("/items/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json(ok(data));
}));
pointsMallRouter.delete("/items/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.deletePointsMallItem(Number(req.params.id)); res.json(ok(data));
}));
pointsMallRouter.put("/items/:id/status", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json(ok(data));
}));
// 积分兑换订单
pointsMallRouter.get("/orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.getPointsMallOrders((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
pointsMallRouter.put("/orders/:id/deliver", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.deliverPointsMallOrder(Number(req.params.id), req.body); res.json(ok(data));
}));
pointsMallRouter.put("/orders/:id/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await pointsMallService.cancelPointsMallOrder(Number(req.params.id)); res.json(ok(data));
}));