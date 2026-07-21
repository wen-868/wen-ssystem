import type { Request, Response, NextFunction } from "express";
import { reportToLingZhou } from "./feishu-report";

/**
 * 错误响应拦截器
 * 职责：仅对 5xx 错误进行飞书告警，错误日志写入统一由 errorHandler 中间件负责
 * 注意：不再在此处调用 insertErrorLog，避免与 errorHandler 形成双重写入
 */
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
    if (statusCode >= 500) {
      const requestUrl = req.originalUrl || req.url || "";
      const requestMethod = req.method || "";
      const userId = (req as { user?: { id: number } }).user?.id || null;
      const tenantId = (req as { tenantId?: number }).tenantId || null;

      const message = body?.message || body?.msg || "服务器内部错误";

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
      }).catch(() => { });
    }

    return originalJson(body);
  };

  next();
}
