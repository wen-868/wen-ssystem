import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import logger from "../../shared/logger";
import * as service from "../../services/admin/error-log.service";

/**
 * S3-179 ②：平台端前端错误上报（同端端点）
 *
 * 背景：saas-admin 原先打 `/api/admin/error-report`（`requireAuthWithTenant` = 商家端鉴权），
 * 平台总后台只有平台令牌 ⇒ **恒 401 且被前端静默吞掉**，线上排障少一只眼睛。
 *
 * 最小实现（本卡红线：不新增表）：落服务端日志即可；字段与商家端端点对齐
 * （error_type / message / stack / url / source / timestamp），便于两端口径一致地排障。
 */
export const reportPlatformFrontendError = asyncHandler(async (req, res) => {
  const { error_type, message, stack, url, method, status_code, source, timestamp } = req.body ?? {};
  logger.error(
    "[platform-error-report] 平台端前端错误上报",
    {
      reportSource: "saas-admin",
      errorType: error_type || "frontend",
      message: message || "前端未知错误",
      requestUrl: url || null,
      requestMethod: method || null,
      statusCode: status_code ?? null,
      clientSource: source || null,
      clientTimestamp: timestamp || null,
      platformAdminId: req.user?.id ?? null,
      stack: typeof stack === "string" ? stack.slice(0, 2000) : null,
    }
  );
  res.json(ok(null));
});

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
