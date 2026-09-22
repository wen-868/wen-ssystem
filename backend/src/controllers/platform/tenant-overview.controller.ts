import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import { getTenantOverview } from "../../services/platform/tenant-overview.service";

/** C1-2 A3：GET /api/platform/tenants/:id/overview - 单租户概况聚合（只读） */
export const getTenantOverviewCtrl = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  if (!id) {
    return next(new AppError("租户 ID 不能为空", 400));
  }
  const result = await getTenantOverview(String(id));
  res.json(ok(result));
});
