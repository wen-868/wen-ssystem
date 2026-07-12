import { Request, Response, NextFunction } from "express";

/** 环形缓冲区容量 */
const BUFFER_CAPACITY = 10000;

/** 滑动窗口时长（秒），只统计最近 60 秒的请求 */
const WINDOW_SECONDS = 60;

interface RequestRecord {
  timestamp: number;   // Date.now()
  responseTime: number; // 毫秒
  statusCode: number;
}

export interface TrackerStats {
  totalRequests: number;
  avgResponseTime: number;
  statusCodes: Record<number, number>;
  errorCount: number;
}

/** 环形缓冲区 */
const buffer: RequestRecord[] = new Array(BUFFER_CAPACITY);
let writeIndex = 0;
let totalInserted = 0; // 总计插入次数，用于判断缓冲区是否已满

/**
 * Express 中间件：记录每个请求的响应时间
 */
export function responseTimeTracker(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // 监听 response finish 事件
  res.on("finish", () => {
    const duration = Date.now() - start;
    const record: RequestRecord = {
      timestamp: Date.now(),
      responseTime: duration,
      statusCode: res.statusCode,
    };

    buffer[writeIndex] = record;
    writeIndex = (writeIndex + 1) % BUFFER_CAPACITY;
    totalInserted++;
  });

  next();
}

/**
 * 获取滑动窗口内的统计数据
 * 只统计最近 WINDOW_SECONDS 秒内的请求
 */
export function getStats(): TrackerStats {
  const now = Date.now();
  const cutoff = now - WINDOW_SECONDS * 1000;

  let totalRequests = 0;
  let totalResponseTime = 0;
  const statusCodes: Record<number, number> = {};
  let errorCount = 0;

  // 遍历缓冲区中的所有有效记录
  const count = Math.min(totalInserted, BUFFER_CAPACITY);
  for (let i = 0; i < count; i++) {
    const record = buffer[i];
    if (record.timestamp < cutoff) continue;

    totalRequests++;
    totalResponseTime += record.responseTime;

    const code = record.statusCode;
    statusCodes[code] = (statusCodes[code] || 0) + 1;

    if (code >= 400) {
      errorCount++;
    }
  }

  const avgResponseTime = totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0;

  return { totalRequests, avgResponseTime, statusCodes, errorCount };
}