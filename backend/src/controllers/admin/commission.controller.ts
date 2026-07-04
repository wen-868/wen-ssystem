import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as commissionService from "../../services/admin/commission.service.js";

const createCommissionRuleSchema = z.object({
  ruleName: z.string().min(1).max(100),
  ruleType: z.enum(["FIXED", "RATIO", "TIERED"]),
  config: z.record(z.any()),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
  remark: z.string().max(500).optional(),
});

const updateCommissionRuleSchema = z.object({
  ruleName: z.string().min(1).max(100).optional(),
  ruleType: z.enum(["FIXED", "RATIO", "TIERED"]).optional(),
  config: z.record(z.any()).optional(),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  remark: z.string().max(500).optional(),
});

const calculateCommissionsSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const settleCommissionsSchema = z.object({
  recordNos: z.array(z.string().min(1)).min(1),
});

// 规则 CRUD
export const listCommissionRules = asyncHandler(async (req, res) => {
  const result = await commissionService.listCommissionRules(req.tenantId!);
  res.json(ok(result));
});

export const createCommissionRule = asyncHandler(async (req, res) => {
  const body = createCommissionRuleSchema.parse(req.body);
  const { ruleName, ruleType, config, effectiveStart, effectiveEnd, remark } = body;
  const result = await commissionService.createCommissionRule({
    ruleName, ruleType, config, effectiveStart, effectiveEnd, remark,
    tenantId: req.tenantId!
  } as any);
  res.json(ok(result));
});

export const updateCommissionRule = asyncHandler(async (req, res) => {
  const body = updateCommissionRuleSchema.parse(req.body);
  const { ruleName, ruleType, config, effectiveStart, effectiveEnd, status, remark } = body;
  const result = await commissionService.updateCommissionRule(Number(req.params.id), {
    ruleName, ruleType, config, effectiveStart, effectiveEnd, status, remark,
    tenantId: req.tenantId!
  } as any);
  res.json(ok(result));
});

export const deleteCommissionRule = asyncHandler(async (req, res) => {
  const result = await commissionService.deleteCommissionRule(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

// 计算引擎
export const calculateCommissions = asyncHandler(async (req, res) => {
  const body = calculateCommissionsSchema.parse(req.body);
  const { startDate, endDate } = body;
  const result = await commissionService.calculateCommissions({
    startDate, endDate, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const settleCommissions = asyncHandler(async (req, res) => {
  const body = settleCommissionsSchema.parse(req.body);
  const { recordNos } = body;
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