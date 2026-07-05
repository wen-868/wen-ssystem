import type { ErrorRequestHandler } from "express";
import { ZodError, type ZodIssue } from "zod";
import logger from "../shared/logger.js";
import { fail } from "../shared/response.js";
import { insertErrorLog } from "../services/admin/error-log.service.js";
import { reportToLingZhou } from "../shared/feishu-report.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(err);

  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  const requestUrl = req.originalUrl || req.url || "";
  const requestMethod = req.method || "";

  // ZodError：参数校验失败，返回 400 及具体字段错误
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e: ZodIssue) => ({
      field: e.path.join(".") || "root",
      message: e.message,
      code: e.code
    }));
    res.status(400).json({ ...fail("参数校验失败", "400"), errors: fieldErrors });
    return;
  }

  // 业务错误：带有 statusCode 属性的错误，返回对应状态码
  if (err && typeof err === "object" && "statusCode" in err) {
    const status = (err as { statusCode?: number }).statusCode as number;
    const message = (err as { message?: string }).message || "请求错误";
    const code = String(status);
    res.status(status).json(fail(message, code));

    // 5xx 错误：记录日志并上报凌舟
    if (status >= 500) {
      insertErrorLog({
        error_type: "server",
        severity: "ERROR",
        message: errorMessage,
        stack: errorStack,
        request_url: requestUrl,
        request_method: requestMethod,
        status_code: status,
      }).catch((e) => logger.error("insertErrorLog failed", e));

      reportToLingZhou({
        phase: "系统错误告警",
        status: "BLOCKED",
        summary: `[${requestMethod}] ${requestUrl} — ${message}`,
        details: [
          { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
          { label: "状态码", value: String(status) },
          { label: "错误消息", value: message },
        ],
        reporter: "系统自动告警",
        webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
      }).catch((e) => logger.error("reportToLingZhou failed", e));
    }
    return;
  }

  // 未知错误：返回 500，记录日志并上报凌舟
  insertErrorLog({
    error_type: "server",
    severity: "FATAL",
    message: errorMessage,
    stack: errorStack,
    request_url: requestUrl,
    request_method: requestMethod,
    status_code: 500,
  }).catch((e) => logger.error("insertErrorLog failed", e));

  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[${requestMethod}] ${requestUrl} — ${errorMessage}`,
    details: [
      { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
      { label: "状态码", value: "500" },
      { label: "错误消息", value: errorMessage },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch((e) => logger.error("reportToLingZhou failed", e));

  res.status(500).json(fail("服务器内部错误", "500"));
};