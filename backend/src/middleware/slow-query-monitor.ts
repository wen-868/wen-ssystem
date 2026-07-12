/**
 * 慢查询监控中间件
 * 记录每条 SQL 执行时间，超过阈值的查询记录到 logger.warn
 */
import type { Request, Response, NextFunction } from "express";
import logger from "../shared/logger";

/** 慢查询阈值（毫秒） */
const SLOW_QUERY_THRESHOLD = 1000;

/** 最大保留慢查询记录数 */
const MAX_RECORDS = 100;

/** 慢查询记录结构 */
export interface SlowQueryRecord {
  sql: string;
  params: unknown[];
  duration: number;
  timestamp: string;
}

/** 慢查询记录缓冲区（最多保留 100 条） */
const slowQueries: SlowQueryRecord[] = [];

/**
 * 记录 SQL 执行耗时
 * 超过阈值的查询会写入缓冲区并输出 warn 日志
 *
 * @param sql - SQL 语句
 * @param params - SQL 参数
 * @param duration - 执行耗时（毫秒）
 */
export function recordQueryExecution(
  sql: string,
  params: unknown[],
  duration: number
): void {
  if (duration <= SLOW_QUERY_THRESHOLD) return;

  const record: SlowQueryRecord = {
    sql,
    params,
    duration,
    timestamp: new Date().toISOString(),
  };

  slowQueries.push(record);
  // 超过上限时移除最早的记录
  if (slowQueries.length > MAX_RECORDS) {
    slowQueries.shift();
  }

  const msg = "[slow-query] " + duration + "ms | SQL: " + sql + " | Params: " + JSON.stringify(params);
  logger.warn(msg);
}

/**
 * 获取最近的慢查询记录
 * @returns 慢查询记录数组（最多 100 条）
 */
export function getSlowQueries(): SlowQueryRecord[] {
  return [...slowQueries];
}

/**
 * 清空慢查询记录（主要用于测试）
 */
export function clearSlowQueries(): void {
  slowQueries.length = 0;
}

/**
 * Express 中间件：监控 HTTP 请求耗时
 * 超过阈值的请求输出 warn 日志
 */
export function slowQueryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD) {
      const msg = "[slow-request] " + duration + "ms | " + req.method + " " + req.url;
      logger.warn(msg);
    }
  });

  next();
}
