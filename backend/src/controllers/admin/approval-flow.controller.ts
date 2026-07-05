import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as approvalFlowService from "../../services/admin/approval-flow.service.js";

export const listRules = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const businessType = req.query.businessType ? String(req.query.businessType) : null;
  const status = req.query.status !== undefined ? Number(req.query.status) : null;

  const result = await approvalFlowService.listRules(page, pageSize, businessType, status, tenantId);
  res.json(ok(result));
});

export const createRule = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    ruleName: z.string().min(1, "规则名称不能为空"),
    businessType: z.enum(["PURCHASE_ORDER", "SALE_RETURN", "PRICE_CHANGE", "CREDIT_LIMIT", "EXPENSE"]),
    triggerCondition: z.any(),
    approvalChain: z.array(z.object({
      level: z.number().int().positive(),
      approverType: z.enum(["ROLE", "USER", "DEPARTMENT"]),
      approverValue: z.string()
    })).min(1),
    slaHours: z.number().int().positive().default(24),
    escalationLevel: z.number().int().min(1).max(3).default(1)
  }).parse(req.body);

  const result = await approvalFlowService.createRule(
    body,
    req.user!.id ?? null,
    req.user!.username ?? "系统用户",
    tenantId
  );
  res.json(ok(result));
});

export const updateRule = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    ruleName: z.string().optional(),
    triggerCondition: z.any().optional(),
    approvalChain: z.array(z.object({
      level: z.number().int().positive(),
      approverType: z.enum(["ROLE", "USER", "DEPARTMENT"]),
      approverValue: z.string()
    })).optional(),
    slaHours: z.number().int().positive().optional(),
    escalationLevel: z.number().int().min(1).max(3).optional(),
    status: z.number().optional()
  }).parse(req.body);

  const result = await approvalFlowService.updateRule(id, body, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "规则不存在" });
    return;
  }
  res.json(ok(result));
});
