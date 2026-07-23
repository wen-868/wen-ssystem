import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/error-log.service";

export const reportFrontendError = asyncHandler(async (req, res) => {
  await service.insertErrorLog({
    error_type: req.body.error_type || "frontend",
    severity: "ERROR",
    message: req.body.message || "前端未知错误",
    stack: req.body.stack || null,
    request_url: req.body.url || null,
    source: "frontend",
    user_id: req.user?.id || undefined,
    tenant_id: req.tenantId || undefined,
  });
  res.json(ok(null));
});

export const listErrorLogs = asyncHandler(async (req, res) => {
  const result = await service.listErrorLogs({
    error_type: req.query.error_type as string,
    severity: req.query.severity as string,
    source: req.query.source as string,
    keyword: req.query.keyword as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
    tenantId: req.tenantId as string,
  });
  res.json(ok(result));
});
