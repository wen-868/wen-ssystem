import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as reconciliationService from "../services/admin/platform-reconciliation.service.js";

export const platformReconciliationRouter = Router();

// ========== 对账列表（分页+筛选） ==========
platformReconciliationRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    reconciliationNo: z.string().optional(),
    platformName: z.string().optional(),
    status: z.coerce.number().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }).parse(req.query);
  const result = await reconciliationService.listReconciliations(tenantId, params);
  res.json(ok(result));
}));

// ========== 创建对账 ==========
platformReconciliationRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const data = z.object({
    reconciliationNo: z.string().min(1),
    platformNo: z.string().min(1),
    platformName: z.string().min(1),
    type: z.number().int().min(0),
    amount: z.number().min(0),
    status: z.number().int().min(0).default(0),
    recordedAt: z.string().optional(),
  }).parse(req.body);
  const result = await reconciliationService.createReconciliation(tenantId, data);
  res.json(ok(result));
}));

// ========== 更新对账 ==========
platformReconciliationRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    status: z.number().int().min(0).optional(),
    amount: z.number().min(0).optional(),
  }).parse(req.body);
  const result = await reconciliationService.updateReconciliation(tenantId, id, data);
  res.json(ok(result));
}));

// ========== 对账详情 ==========
platformReconciliationRouter.get("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reconciliationService.getDetail(tenantId, id);
  res.json(ok(result));
}));