import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as stackRuleService from "../../services/admin/marketing-stack-rule.service.js";

export const createStackRule = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    typeCombination: z.array(z.array(z.string())).min(1),
    maxTotalDiscountRate: z.number().min(0).max(1.9999).default(1.0),
    priority: z.number().int().default(0),
    enabled: z.boolean().default(true)
  }).parse(req.body);

  const result = await stackRuleService.createStackRule(body, req.tenantId!);
  res.json(ok(result));
});

export const listStackRules = asyncHandler(async (req, res) => {
  const result = await stackRuleService.listStackRules(req.tenantId!);
  res.json(ok(result));
});

export const updateStackRule = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    typeCombination: z.array(z.array(z.string())).min(1).optional(),
    maxTotalDiscountRate: z.number().min(0).max(1.9999).optional(),
    priority: z.number().int().optional(),
    enabled: z.boolean().optional()
  }).parse(req.body);

  const result = await stackRuleService.updateStackRule(
    Number(req.params.id),
    body,
    req.tenantId!
  );
  res.json(ok(result));
});

export const deleteStackRule = asyncHandler(async (req, res) => {
  const result = await stackRuleService.deleteStackRule(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});
