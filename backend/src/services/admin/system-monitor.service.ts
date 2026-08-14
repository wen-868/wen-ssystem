/**
 * 系统资源监控服务
 * 使用 Node.js 内置模块（os, process）获取内存、CPU、进程信息
 */
import os from "node:os";
import { queryOne } from "../../shared/db";

/** 内存使用情况 */
export interface MemoryUsageInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

/** CPU 使用情况 */
export interface CpuUsageInfo {
  loadAverage1: number;
  loadAverage5: number;
  loadAverage15: number;
}

/** 进程信息 */
export interface ProcessInfo {
  pid: number;
  uptime: number;
  nodeVersion: string;
}

/** 数据库连接状态 */
export interface DatabaseStatus {
  status: "connected" | "disconnected";
}

/** 综合健康检查结果 */
export interface SystemHealth {
  memory: MemoryUsageInfo;
  cpu: CpuUsageInfo;
  database: DatabaseStatus;
  status: "UP" | "DOWN";
  timestamp: string;
}

/**
 * 获取内存使用情况
 * @returns rss、heapTotal、heapUsed、external（字节）
 */
export function getMemoryUsage(): MemoryUsageInfo {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
  };
}

/**
 * 获取 CPU 使用情况
 * @returns 1/5/15 分钟负载均值
 */
export function getCpuUsage(): CpuUsageInfo {
  const load = os.loadavg();
  return {
    loadAverage1: load[0],
    loadAverage5: load[1],
    loadAverage15: load[2],
  };
}

/**
 * 获取进程信息
 * @returns pid、uptime（秒）、node 版本
 */
export function getProcessInfo(): ProcessInfo {
  return {
    pid: process.pid,
    uptime: process.uptime(),
    nodeVersion: process.version,
  };
}

/**
 * 综合健康检查
 * 返回内存、CPU、数据库连接状态
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const memory = getMemoryUsage();
  const cpu = getCpuUsage();

  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    await queryOne("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  return {
    memory,
    cpu,
    database: { status: dbStatus },
    status: dbStatus === "connected" ? "UP" : "DOWN",
    timestamp: new Date().toISOString(),
  };
}
