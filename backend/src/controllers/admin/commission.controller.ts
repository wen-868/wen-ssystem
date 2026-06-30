import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as commissionService from "../../services/admin/commission.service.js";

// 规则 CRUD
export const listCommissionRules = asyncHandler(async (req, res) => {
  const result = await commissionService.listCommissionRules(req.tenantId!);
  res.json(ok(result));
});

export const createCommissionRule = asyncHandler(async (req, res) => {
  const { ruleName, ruleType, config, effectiveStart, effectiveEnd, remark } = req.body;
  const result = await commissionService.createCommissionRule({
    ruleName, ruleType, config, effectiveStart, effectiveEnd, remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const updateCommissionRule = asyncHandler(async (req, res) => {
  const { ruleName, ruleType, config, effectiveStart, effectiveEnd, status, remark } = req.body;
  const result = await commissionService.updateCommissionRule(Number(req.params.id), {
    ruleName, ruleType, config, effectiveStart, effectiveEnd, status, remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const deleteCommissionRule = asyncHandler(async (req, res) => {
  const result = await commissionService.deleteCommissionRule(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

// 计算引擎
export const calculateCommissions = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const result = await commissionService.calculateCommissions({
    startDate, endDate, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const settleCommissions = asyncHandler(async (req, res) => {
  const { recordNos } = req.body;
  const result = await commissionService.settleCommissions({
    recordNos, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listCommissionRecords = asyncHandler(async (req, res) => {
  const result = await commissionService.listCommissionRecords({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    staffId: req.query.staffId ? Number(req.query.staffId) : undefined,
    status: req.query.status as string | undefined,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});