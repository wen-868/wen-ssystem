import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as careService from "../../services/admin/customer-care.service.js";

const createCareRuleSchema = z.object({
  ruleName: z.string().min(1).max(100),
  triggerType: z.string().min(1).max(50),
  templateContent: z.string().max(5000).optional(),
  rewardPoints: z.number().int().min(0).optional(),
  rewardCouponId: z.number().int().positive().optional(),
});

const updateCareRuleSchema = z.object({
  ruleName: z.string().min(1).max(100).optional(),
  triggerType: z.string().min(1).max(50).optional(),
  templateContent: z.string().max(5000).optional(),
  rewardPoints: z.number().int().min(0).optional(),
  rewardCouponId: z.number().int().positive().optional(),
  enabled: z.number().int().min(0).max(1).optional(),
});

export const listCareRules = asyncHandler(async (req, res) => { res.json(ok(await careService.listCareRules(req.tenantId!))); });
export const createCareRule = asyncHandler(async (req, res) => {
  const body = createCareRuleSchema.parse(req.body);
  const { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId } = body;
  res.json(ok(await careService.createCareRule({ ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, tenantId: req.tenantId! })));
});
export const updateCareRule = asyncHandler(async (req, res) => {
  const body = updateCareRuleSchema.parse(req.body);
  const { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, enabled } = body;
  res.json(ok(await careService.updateCareRule(Number(req.params.id), { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, enabled, tenantId: req.tenantId! })));
});
export const deleteCareRule = asyncHandler(async (req, res) => { res.json(ok(await careService.deleteCareRule(Number(req.params.id), req.tenantId!))); });
export const listCareLogs = asyncHandler(async (req, res) => {
  res.json(ok(await careService.listCareLogs({
    customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});
export const executeCareRule = asyncHandler(async (req, res) => { res.json(ok(await careService.executeCareRule(Number(req.params.id), req.tenantId!))); });