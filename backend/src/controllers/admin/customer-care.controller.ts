import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as careService from "../../services/admin/customer-care.service.js";

export const listCareRules = asyncHandler(async (req, res) => { res.json(ok(await careService.listCareRules(req.tenantId!))); });
export const createCareRule = asyncHandler(async (req, res) => {
  const { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId } = req.body;
  res.json(ok(await careService.createCareRule({ ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, tenantId: req.tenantId! })));
});
export const updateCareRule = asyncHandler(async (req, res) => {
  const { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, enabled } = req.body;
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