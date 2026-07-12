import type { Request, Response, NextFunction } from "express";
import { insertErrorLog } from "../services/admin/error-log.service";
import { reportToLingZhou } from "./feishu-report";

export function errorResponseInterceptor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = 200;

  res.status = (code: number) => {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = (body: any) => {
    if (statusCode >= 400) {
      const requestUrl = req.originalUrl || req.url || "";
      const requestMethod = req.method || "";
      const userId = (req as { user?: { id: number } }).user?.id || null;
      const tenantId = (req as { tenantId?: number }).tenantId || null;

      const message = body?.message || body?.msg || "请求错误";
      const errorType = statusCode >= 500
        ? "server"
        : statusCode === 401 || statusCode === 403
        ? "auth"
        : statusCode === 400 || statusCode === 422
        ? "validation"
        : statusCode === 404
        ? "not_found"
        : "business";

      const severity = statusCode >= 500
        ? "ERROR"
        : statusCode === 403 || statusCode === 429
        ? "ERROR"
        : "WARN";

      insertErrorLog({
        error_type: errorType,
        severity,
        message,
        request_url: requestUrl,
        request_method: requestMethod,
        status_code: statusCode,
        user_id: userId as any,
        tenant_id: tenantId as any,
      }).catch(() => {});

      if (statusCode >= 500) {
        reportToLingZhou({
          phase: "系统错误告警",
          status: "BLOCKED",
          summary: `[${requestMethod}] ${requestUrl} — ${message}`,
          details: [
            { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
            { label: "用户ID", value: userId || "未登录" },
            { label: "租户ID", value: tenantId || "N/A" },
            { label: "状态码", value: String(statusCode) },
            { label: "错误消息", value: message },
          ],
          reporter: "系统自动告警",
          webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
        }).catch(() => {});
      }
    }

    return originalJson(body);
  };

  next();
}
