import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import * as service from "../../services/platform/tenant-quota.service";

/** GET /api/platform/tenants/:id/quota - 租户资源配额使用情况（只读聚合） */
export const getTenantQuotaCtrl = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  if (!id) {
    return next(new AppError("租户 ID 不能为空", 400));
  }
  const result = await service.getTenantQuota(id);
  res.json(ok(result));
});
