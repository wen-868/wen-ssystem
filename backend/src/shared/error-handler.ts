import { ZodError, type ZodIssue } from "zod";
import { fail } from "./response.js";
import { insertErrorLog } from "../services/admin/error-log.service.js";
import { reportToLingZhou } from "./feishu-report.js";
import { logger } from "./logger.js";

export const errorHandler: any = (err: any, req: any, res: any, _next: any) => {
  logger.error(`[${req.method}] ${req.originalUrl || req.url} — ${err?.message || "未知错误"}`, err);

  const requestUrl = req?.originalUrl || req?.url || "";
  const requestMethod = req?.method || "";
  const userId = req?.user?.id || null;
  const tenantId = req?.tenantId || null;

  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e: ZodIssue) => ({
      field: e.path.join(".") || "root",
      message: e.message,
      code: e.code,
    }));

    insertErrorLog({
      error_type: "validation",
      severity: "WARN",
      message: `参数校验失败: ${err.errors.map((e) => e.message).join("; ")}`,
      request_url: requestUrl,
      request_method: requestMethod,
      status_code: 400,
      user_id: userId,
      tenant_id: tenantId,
    }).catch(() => {});

    res.status(400).json({ code: "400", message: "参数校验失败", errors: fieldErrors });
    return;
  }

  if (err && typeof err === "object" && "statusCode" in err) {
    const status = (err as any).statusCode as number;
    const message = (err as any).message || "请求错误";
    const code = String(status);

    insertErrorLog({
      error_type: "business",
      severity: status >= 500 ? "ERROR" : status === 403 || status === 429 ? "ERROR" : "WARN",
      message,
      stack: err.stack || null,
      request_url: requestUrl,
      request_method: requestMethod,
      status_code: status,
      user_id: userId,
      tenant_id: tenantId,
    }).catch(() => {});

    if (status >= 500) {
      reportToLingZhou({
        phase: "系统错误告警",
        status: "BLOCKED",
        summary: `[${requestMethod}] ${requestUrl} — ${message}`,
        details: [
          { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
          { label: "用户ID", value: userId || "未登录" },
          { label: "租户ID", value: tenantId || "N/A" },
          { label: "状态码", value: String(status) },
          { label: "错误消息", value: message },
        ],
        reporter: "系统自动告警",
        webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
      }).catch(() => {});
    }

    res.status(status).json(fail(message, code));
    return;
  }

  insertErrorLog({
    error_type: "unknown",
    severity: "ERROR",
    message: err?.message || "未知服务器错误",
    stack: err?.stack || null,
    request_url: requestUrl,
    request_method: requestMethod,
    status_code: 500,
    user_id: userId,
    tenant_id: tenantId,
  }).catch(() => {});

  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[${requestMethod}] ${requestUrl} — ${err?.message || "未知服务器错误"}`,
    details: [
      { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
      { label: "用户ID", value: userId || "未登录" },
      { label: "租户ID", value: tenantId || "N/A" },
      { label: "错误消息", value: err?.message || "未知错误" },
      { label: "堆栈", value: (err?.stack || "").split("\n").slice(0, 3).join("\n") },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch(() => {});

  res.status(500).json(fail("服务器内部错误", "500"));
};
