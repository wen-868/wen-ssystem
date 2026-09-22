import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import { copyPlan } from "../../services/platform/plan-copy.service";

/**
 * C1-2 B2：POST /api/platform/plans/:planId/copy
 * 复制套餐（写操作）；编码冲突 → 409；非法状态 → 400
 */
export const copyPlanCtrl = asyncHandler(async (req, res, next) => {
  const planId = Number(req.params.planId ?? req.params.id);
  if (!Number.isFinite(planId) || planId <= 0) {
    return next(new AppError("套餐ID非法", 400));
  }

  const body = req.body ?? {};
  const operator = String(req.user?.username || req.user?.realName || "platform_admin");
  const result = await copyPlan(
    planId,
    {
      planCode: body.planCode == null ? undefined : String(body.planCode),
      planName: body.planName == null ? undefined : String(body.planName),
      status: body.status == null ? undefined : String(body.status),
    },
    operator
  );
  res.json(ok(result));
});
