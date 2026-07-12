import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as visitPlanService from "../../services/admin/visit-plan.service";

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
  const body = visitPlanService.updateVisitPlanSchema.parse(req.body);
  const result = await visitPlanService.updateVisitPlan(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo,
    body
  );
  res.json(ok(result));
});

export const cancelVisitPlan = asyncHandler(async (req, res) => {
  const result = await visitPlanService.cancelVisitPlan(
    req.tenantId!,
    req.user!.id,
    req.user!.username,
    req.params.visitNo
  );
  res.json(ok(result));
});
