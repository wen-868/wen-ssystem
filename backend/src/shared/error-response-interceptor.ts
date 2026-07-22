import type { Request, Response, NextFunction } from "express";

/**
 * 错误响应拦截器
 *
 * 职责：响应降级/重定向扩展点（当前为透传）。
 *
 * 历史背景（R55-02）：
 *  - 修复前：本中间件会拦截 5xx 响应并调用 reportToLingZhou 发送飞书告警，
 *    但全局 errorHandler（middleware/error-handler.ts）在捕获 5xx 异常时也会
 *    调用 reportToLingZhou 发送告警，导致同一条错误告警被发送两次。
 *  - 修复后：移除本中间件的 reportToLingZhou 调用，飞书告警统一由 errorHandler
 *    负责（errorHandler 是错误处理的唯一权威源，见踩坑日志 [9]/[70] 的分层原则）；
 *    本中间件仅保留作为响应降级/重定向的扩展点，当前不做任何拦截。
 *
 * 关联任务：R55-02 双重飞书告警
 */
export function errorResponseInterceptor(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  next();
}
