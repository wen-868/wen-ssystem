import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as visitPlanService from "../../services/admin/visit-plan.service.js";

export const createVisitPlan = asyncHandler(async (req, res) => {
  const body = visitPlanService.createVisitPlanSchema.parse(req.body);
  const result = await visitPlanService.createVisitPlan(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.user!.realName,
    body
  );
  res.json(ok(result));
});

export const updateVisitPlan = asyncHandler(async (req, res) => {
  try {
    const body = visitPlanService.updateVisitPlanSchema.parse(req.body);
    const result = await visitPlanService.updateVisitPlan(
      req.tenantId!,
      req.user!.id,
      req.user!.username,
      req.params.visitNo,
      body
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const cancelVisitPlan = asyncHandler(async (req, res) => {
  try {
    const result = await visitPlanService.cancelVisitPlan(
      req.tenantId!,
      req.user!.id,
      req.user!.username,
      req.params.visitNo
    );
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});
