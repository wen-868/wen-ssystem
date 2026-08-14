import { describe, it, expect, beforeEach, vi } from "vitest";
import { circuitBreaker, resetBreaker } from "../../middleware/circuit-breaker";

function mockRes() {
  const res: any = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    statusCode: 200,
    on: vi.fn((evt: string, cb: () => void) => {
      if (evt === "finish") res._finish = cb;
    }),
    _finish: null as (() => void) | null,
  };
  return res;
}

function mockReq() {
  return { originalUrl: "/api/store/dashboard" };
}

async function callMw(mw: any, res: any, code: string) {
  const next = vi.fn();
  await mw(mockReq() as any, res as any, next);
  res.json({ code });
  res._finish?.();
}

describe("circuit-breaker - 状态机", () => {
  beforeEach(() => {
    resetBreaker("test-api");
  });

  it("正常流量不触发熔断（CLOSED）", async () => {
    const mw = circuitBreaker({ key: "test-api", minRequests: 5, failureThreshold: 0.5 });
    const res = mockRes();
    await callMw(mw, res, "0");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("失败率超阈值后熔断打开返回 503", async () => {
    const mw = circuitBreaker({ key: "test-api", minRequests: 4, failureThreshold: 0.5 });
    // 3 次失败 + 1 次成功 → 失败率 75% ≥ 50% → OPEN
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      await callMw(mw, res, "500");
    }
    const resOk = mockRes();
    await callMw(mw, resOk, "0");
    // 熔断已打开，后续请求直接 503
    const resOpen = mockRes();
    const next = vi.fn();
    await mw(mockReq() as any, resOpen as any, next);
    expect(resOpen.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("熔断打开后经 openMs 进入 HALF_OPEN，试探成功恢复 CLOSED", async () => {
    vi.useFakeTimers();
    const mw = circuitBreaker({ key: "test-api", minRequests: 2, failureThreshold: 0.5, openMs: 30_000 });
    // 2 次失败 → OPEN
    for (let i = 0; i < 2; i++) {
      const res = mockRes();
      await callMw(mw, res, "500");
    }
    // OPEN 期间 503
    const resOpen = mockRes();
    await mw(mockReq() as any, resOpen as any, vi.fn());
    expect(resOpen.status).toHaveBeenCalledWith(503);

    // 时间推进超过 openMs → HALF_OPEN，试探成功 → CLOSED
    vi.advanceTimersByTime(31_000);
    const resProbe = mockRes();
    await callMw(mw, resProbe, "0");
    expect(resProbe.status).not.toHaveBeenCalled();
    // 恢复后正常放行
    const resOk = mockRes();
    await callMw(mw, resOk, "0");
    expect(resOk.status).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("fallback 存在时熔断走降级回调而非 503", async () => {
    const mw = circuitBreaker({
      key: "test-api",
      minRequests: 2,
      failureThreshold: 0.5,
      fallback: (_req, res) => { res.status(200).json({ code: "0", data: { degraded: true } }); },
    });
    for (let i = 0; i < 2; i++) {
      const res = mockRes();
      await callMw(mw, res, "500");
    }
    const resOpen = mockRes();
    await mw(mockReq() as any, resOpen as any, vi.fn());
    expect(resOpen.status).toHaveBeenCalledWith(200);
    expect(resOpen.json).toHaveBeenCalledWith({ code: "0", data: { degraded: true } });
  });
});
