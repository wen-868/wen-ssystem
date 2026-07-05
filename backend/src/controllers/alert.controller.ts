import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/alert.service.js";

export const list = asyncHandler(async (req, res) => {
  const result = await service.listAlerts({
    tenantId: req.tenantId!,
    ruleType: req.query.ruleType as string | undefined,
    alertLevel: req.query.alertLevel as string | undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  res.json(ok(result));
});

export const count = asyncHandler(async (req, res) => {
  const result = await service.getAlertCounts(req.tenantId!);
  res.json(ok(result));
});

export const handle = asyncHandler(async (req, res) => {
  const body = z.object({
    action: z.enum(["HANDLE", "IGNORE"]),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await service.handleAlert(
    Number(req.params.id),
    req.tenantId!,
    body.action,
    body.remark,
    req.user?.id ?? 0,
    req.user?.username ?? "system"
  );
  res.json(ok(result));
});

export const rules = asyncHandler(async (req, res) => {
  const result = await service.listAlertRules(req.tenantId!);
  res.json(ok(result));
});

export const updateRule = asyncHandler(async (req, res) => {
  const body = z.object({
    enabled: z.boolean().optional(),
    thresholdValue: z.number().optional(),
    description: z.string().optional()
  }).parse(req.body);

  const result = await service.updateAlertRule(Number(req.params.id), req.tenantId!, body);
  res.json(ok(result));
});

export const check = asyncHandler(async (req, res) => {
  const result = await service.runAllAlertChecks();
  res.json(ok({
    message: `预警检查完成，新增 ${result.total} 条预警`,
    ...result
  }));
});

// 别名：routes 层引用的名称
export const listAlerts = list;
export const getAlertCounts = count;
export const handleAlert = handle;
export const listAlertRules = rules;
export const updateAlertRule = updateRule;
export const runCheck = check;