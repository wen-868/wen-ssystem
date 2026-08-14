import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../../shared/http-with-retry";

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("http-with-retry - 外部调用超时与重试", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("成功请求不重试直接返回", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", mockFetch);
    const resp = await fetchWithRetry("https://example.com", {}, { retries: 2, backoffMs: 100 });
    expect(resp.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("5xx 失败后指数退避重试并最终成功", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", mockFetch);
    const promise = fetchWithRetry("https://example.com", {}, { retries: 2, backoffMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    const resp = await promise;
    expect(resp.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("重试耗尽后抛出最后一次错误", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 500 });
    vi.stubGlobal("fetch", mockFetch);
    const promise = fetchWithRetry("https://example.com", {}, { retries: 1, backoffMs: 100 });
    const assertion = expect(promise).rejects.toThrow(/HTTP 500/);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("网络错误触发重试", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal("fetch", mockFetch);
    const promise = fetchWithRetry("https://example.com", {}, { retries: 1, backoffMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const resp = await promise;
    expect(resp.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("超时中止请求", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, options: any) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    }));
    vi.stubGlobal("fetch", mockFetch);
    const promise = fetchWithRetry("https://example.com", {}, { timeoutMs: 50, retries: 0 });
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});
