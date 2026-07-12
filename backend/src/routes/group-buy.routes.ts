import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { ok } from "../shared/response";
import * as groupBuyService from "../services/admin/group-buy.service";
import { asyncHandler } from "../middleware/async-handler";

export const groupBuyRouter = Router();

// 拼团活动
groupBuyRouter.get("/activities", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.getGroupBuyActivities((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
groupBuyRouter.post("/activities", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.createGroupBuyActivity(req.body); res.json(ok(data));
}));
groupBuyRouter.put("/activities/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.updateGroupBuyActivity(Number(req.params.id), req.body); res.json(ok(data));
}));
groupBuyRouter.delete("/activities/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.deleteGroupBuyActivity(Number(req.params.id)); res.json(ok(data));
}));
// 拼团记录
groupBuyRouter.get("/records", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.getGroupBuyRecords((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
groupBuyRouter.get("/records/:groupNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.getGroupBuyRecordDetail(req.params.groupNo); res.json(ok(data));
}));
groupBuyRouter.put("/records/:groupNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await groupBuyService.cancelGroupBuyRecord(req.params.groupNo); res.json(ok(data));
}));