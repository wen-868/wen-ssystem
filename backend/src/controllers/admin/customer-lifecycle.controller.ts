import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as lifecycleService from "../../services/admin/customer-lifecycle.service.js";

export const getLifecycleStages = asyncHandler(async (req, res) => { res.json(ok(await lifecycleService.getLifecycleStages(req.tenantId!))); });
export const getLifecycleTrend = asyncHandler(async (req, res) => {
  res.json(ok(await lifecycleService.getLifecycleTrend(req.tenantId!, Number(req.query.months || 6))));
});
export const getLifecycleDetail = asyncHandler(async (req, res) => {
  res.json(ok(await lifecycleService.getLifecycleDetail({
    stage: req.query.stage as string | undefined,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});