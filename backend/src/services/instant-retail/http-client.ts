/**
 * 即时零售平台 HTTP 客户端
 * 提供 OAuth 令牌刷新、自动重试、降级策略、Mock 模式开关
 */

import { env } from "../../shared/env.js";

const isMock = () => env.INSTANT_RETAIL_MOCK === "true";

/** 重试配置 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenExpireAt: Date;
}

/** 令牌刷新回调 */
type TokenRefreshFn = () => Promise<TokenPair>;

/** 全局令牌缓存（按平台） */
const tokenCache = new Map<string, TokenPair>();

/**
 * 通用 HTTP 请求（含自动重试）
 */
async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", headers = {}, body, timeout = 15000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (RETRY_CONFIG.retryableStatuses.includes(res.status)) {
        throw new Error(`Retryable HTTP ${res.status}: ${res.statusText}`);
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
          RETRY_CONFIG.maxDelayMs
        );
        console.info(`[HTTP] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms for ${url}`);
        await sleep(delay);
      }
    }
  }

  clearTimeout(timer);
  throw lastError ?? new Error(`Request failed: ${url}`);
}

/**
 * 带 OAuth 令牌的请求
 * 自动在请求头中注入 Authorization，令牌过期时自动刷新
 */
async function authedRequest(
  platform: string,
  url: string,
  options: RequestOptions = {},
  refreshFn: TokenRefreshFn
): Promise<Response> {
  let token = tokenCache.get(platform);
  if (!token || new Date() >= token.tokenExpireAt) {
    token = await refreshFn();
    tokenCache.set(platform, token);
  }

  const res = await request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.accessToken}`,
    },
  });

  if (res.status === 401) {
    token = await refreshFn();
    tokenCache.set(platform, token);
    return request(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
  }

  return res;
}

/**
 * 判断是否使用 Mock 模式
 */
export function useMock(): boolean {
  return isMock();
}

/**
 * 执行平台 API 调用（自动选择 Mock 或真实）
 */
export async function platformCall<T>(
  platform: string,
  url: string,
  options: RequestOptions,
  refreshFn: TokenRefreshFn,
  mockFn: () => Promise<any>
): Promise<T> {
  if (isMock()) {
    console.info(`[${platform}] MOCK mode: ${options.method ?? "GET"} ${url}`);
    return mockFn();
  }

  try {
    const res = await authedRequest(platform, url, options, refreshFn);
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`[${platform}] API error ${res.status}: ${errorBody}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[${platform}] API call failed: ${err instanceof Error ? err.message : err}`);
    throw err;
  }
}

/** 清除平台令牌缓存 */
export function clearTokenCache(platform?: string): void {
  if (platform) {
    tokenCache.delete(platform);
  } else {
    tokenCache.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}