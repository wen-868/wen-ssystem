import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/error-log.service";

/**
 * R97-01: 平台版错误日志列表（全租户范围）
 *
 * 复用 admin error-log.service.listErrorLogs，但不传 tenantId，
 * 返回结构对齐 saas-admin/src/views/ErrorLogs.vue 期望：
 *   res.data = { records: [...], total }
 * 行字段为驼峰：errorType / severity / message / stack / requestUrl / source / createdAt 等
 */
export const listPlatformErrorLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const result = await service.listErrorLogs({
    error_type: req.query.error_type as string | undefined,
    severity: req.query.severity as string | undefined,
    source: req.query.source as string | undefined,
    keyword: req.query.keyword as string | undefined,
    page,
    pageSize,
  });

  const records = result.items.map((row: Record<string, unknown>) => ({
    id: row.id,
    errorType: row.error_type,
    severity: row.severity,
    message: row.message,
    stack: row.stack,
    requestUrl: row.request_url,
    requestMethod: row.request_method,
    statusCode: row.status_code,
    userId: row.user_id,
    tenantId: row.tenant_id,
    source: row.source,
    createdAt: row.created_at,
  }));

  res.json(ok({ records, total: result.total, page, pageSize }));
});
