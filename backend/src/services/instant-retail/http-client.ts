/**
 * 即时零售平台 HTTP 客户端
 * 统一管理对外部平台 API 的 HTTP 请求，支持 Mock 模式切换。
 *
 * Mock 模式仅在环境变量 INSTANT_RETAIL_MOCK="true" 时启用，
 * 空值或未设置时默认走真实请求。
 */

import { env } from "../../shared/env";
import logger from "../../shared/logger";

/** 仅当显式设置 INSTANT_RETAIL_MOCK=true 时才启用 Mock */
export function isMock(): boolean {
  return env.INSTANT_RETAIL_MOCK === 'true';
}

export interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export class HttpClient {
  private baseURL: string;
  private timeout: number;

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL ?? "";
    this.timeout = options.timeout ?? 30000;
  }

  async get<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
    if (isMock()) {
      logger.info(`[HttpClient] Mock GET ${this.baseURL}${path}`);
      return {} as T;
    }
    return this.fetch<T>("GET", path, opts);
  }

  async post<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
    if (isMock()) {
      logger.info(`[HttpClient] Mock POST ${this.baseURL}${path}`);
      return {} as T;
    }
    return this.fetch<T>("POST", path, opts);
  }

  async put<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
    if (isMock()) {
      logger.info(`[HttpClient] Mock PUT ${this.baseURL}${path}`);
      return {} as T;
    }
    return this.fetch<T>("PUT", path, opts);
  }

  async delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
    if (isMock()) {
      logger.info(`[HttpClient] Mock DELETE ${this.baseURL}${path}`);
      return {} as T;
    }
    return this.fetch<T>("DELETE", path, opts);
  }

  private async fetch<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseURL}${path}`;
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...opts?.headers,
        },
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }

      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ==================== 平台调用封装 ====================

/**
 * 统一的平台 API 调用封装
 * 支持 Mock 降级和 token 自动刷新
 */
export async function platformCall<T>(
  platform: string,
  url: string,
  options: { method: string; body?: unknown; headers?: Record<string, string> },
  onTokenRefresh: () => Promise<unknown>,
  mockFallback: () => Promise<T>
): Promise<T> {
  if (useMock()) {
    return mockFallback();
  }
  // 真实调用逻辑（简化版）
  try {
    const client = new HttpClient({ baseURL: "", timeout: 15000 });
    const res = await (client as unknown as { fetch: (method: string, url: string, opts: unknown) => Promise<unknown> }).fetch(options.method, url, {
      headers: options.headers,
      body: options.body,
    });
    return res as T;
  } catch (err: unknown) {
    const message = (err as Error)?.message ?? "";
    if (message.includes("401") || message.includes("403")) {
      await onTokenRefresh();
      const client = new HttpClient({ baseURL: "", timeout: 15000 });
      const res = await (client as unknown as { fetch: (method: string, url: string, opts: unknown) => Promise<unknown> }).fetch(options.method, url, {
        headers: options.headers,
        body: options.body,
      });
      return res as T;
    }
    throw err;
  }
}

/** 是否启用 Mock 模式 */
export function useMock(): boolean {
  return isMock();
}