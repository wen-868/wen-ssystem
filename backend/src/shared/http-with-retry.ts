import logger from "./logger";

/**
 * 外部 HTTP 调用统一超时 + 重试工具（验收检查项：超时与重试）
 *
 * 特性：
 * - 超时控制（AbortController），默认 10s
 * - 指数退避重试（默认最多 2 次：1s、2s 后重试）
 * - 网络错误 / 5xx / 可配置状态码触发重试（幂等语义由调用方把关）
 * - 恒定超时：单次请求总时间受 timeoutMs 限制
 */

export interface FetchWithRetryOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  retryOnStatus?: (status: number) => boolean;
}

async function fetchOnce(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  opts: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries = 2,
    backoffMs = 1_000,
    retryOnStatus = (status) => status >= 500,
  } = opts;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = backoffMs * 2 ** (attempt - 1);
      logger.warn(`[http-retry] ${url} 第 ${attempt} 次重试（${wait}ms 后）`);
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      const resp = await fetchOnce(url, options, timeoutMs);
      if (!retryOnStatus(resp.status)) {
        return resp;
      }
      lastError = new Error(`HTTP ${resp.status}`);
      if (attempt < retries) {
        logger.warn(`[http-retry] ${url} 返回 ${resp.status}，将重试`);
      }
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        logger.warn(`[http-retry] ${url} 请求失败（${String(err)}），将重试`);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`外部请求失败: ${String(lastError)}`);
}
