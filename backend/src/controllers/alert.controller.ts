import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/alert.service.js";

export const list = asyncHandler(async (req, res) => {
  const result = await service.listAlerts(
    req.tenantId!,
    {
      ruleType: req.query.ruleType as string | undefined,
      alertLevel: req.query.alertLevel as string | undefined,
      status: req.query.status as string | undefined,
    },
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
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

  try {
    const result = await service.handleAlert(
      req.tenantId!,
      Number(req.params.id),
      body.action,
      body.remark,
      req.user!.id ?? 0,
      req.user!.username ?? "system"
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
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

  try {
    const result = await service.updateAlertRule(req.tenantId!, Number(req.params.id), body);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const check = asyncHandler(async (req, res) => {
  const result = await service.runAllAlertChecks();
  res.json(ok({
    message: `预警检查完成，新增 ${result.total} 条预警`,
    ...result
  }));
});