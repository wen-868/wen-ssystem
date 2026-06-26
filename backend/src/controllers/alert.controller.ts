import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/alert.service.js";

export const listAlerts = asyncHandler(async (req, res) => {
  const result = await service.listAlerts({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    ruleType: req.query.ruleType as string | undefined,
    alertLevel: req.query.alertLevel as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json(ok(result));
});

export const getAlertCounts = asyncHandler(async (req, res) => {
  const result = await service.getAlertCounts(req.tenantId!);
  res.json(ok(result));
});

export const handleAlert = asyncHandler(async (req, res) => {
  try {
    const result = await service.handleAlert(
      Number(req.params.id),
      req.tenantId!,
      req.body.action,
      req.body.remark,
      req.user!.id,
      req.user!.username
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const listAlertRules = asyncHandler(async (req, res) => {
  const result = await service.listAlertRules(req.tenantId!);
  res.json(ok(result));
});

export const updateAlertRule = asyncHandler(async (req, res) => {
  try {
    const result = await service.updateAlertRule(
      Number(req.params.id),
      req.tenantId!,
      req.body
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const runCheck = asyncHandler(async (req, res) => {
  const result = await service.runCheck(req.tenantId!);
  res.json(ok(result));
});