/**
 * 接口响应时间中间件
 * 记录所有 HTTP 请求的响应时间，用于性能监控和分析
 */

import type { Request, Response, NextFunction } from "express";
import logger from "../shared/logger";

/** 响应时间记录结构 */
export interface ResponseTimeRecord {
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  timestamp: string;
}

/** 最大保留记录数 */
const MAX_RECORDS = 200;

/** 响应时间记录缓冲区 */
const responseTimes: ResponseTimeRecord[] = [];

/**
 * Express 中间件：记录所有接口响应时间
 */
export function responseTimeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const record: ResponseTimeRecord = {
      method: req.method,
      url: req.url,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    };

    // 添加到缓冲区
    responseTimes.push(record);
    if (responseTimes.length > MAX_RECORDS) {
      responseTimes.shift();
    }

    // 根据响应时间输出不同级别的日志
    if (duration >= 1000) {
      logger.warn(`[slow-response] ${duration}ms | ${req.method} ${req.url} | status: ${res.statusCode}`);
    } else if (duration >= 500) {
      logger.info(`[medium-response] ${duration}ms | ${req.method} ${req.url} | status: ${res.statusCode}`);
    } else if (process.env.NODE_ENV === "development") {
      // 开发环境记录所有响应时间
      logger.debug(`[response-time] ${duration}ms | ${req.method} ${req.url} | status: ${res.statusCode}`);
    }
  });

  next();
}

/**
 * 获取最近的响应时间记录
 * @returns 响应时间记录数组（最多 200 条）
 */
export function getResponseTimes(): ResponseTimeRecord[] {
  return [...responseTimes];
}

/**
 * 获取响应时间统计信息
 * @returns 统计信息对象
 */
export function getResponseTimeStats(): {
  totalRequests: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  p50Duration: number;
  p90Duration: number;
  p99Duration: number;
  slowCount: number;
} {
  if (responseTimes.length === 0) {
    return {
      totalRequests: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      p50Duration: 0,
      p90Duration: 0,
      p99Duration: 0,
      slowCount: 0,
    };
  }

  const durations = responseTimes.map(r => r.duration).sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);

  const getPercentile = (percentile: number): number => {
    const index = Math.floor((percentile / 100) * (durations.length - 1));
    return durations[index] || 0;
  };

  return {
    totalRequests: responseTimes.length,
    avgDuration: Math.round(total / durations.length),
    maxDuration: durations[durations.length - 1],
    minDuration: durations[0],
    p50Duration: getPercentile(50),
    p90Duration: getPercentile(90),
    p99Duration: getPercentile(99),
    slowCount: responseTimes.filter(r => r.duration >= 1000).length,
  };
}

/**
 * 清空响应时间记录（主要用于测试）
 */
export function clearResponseTimes(): void {
  responseTimes.length = 0;
}