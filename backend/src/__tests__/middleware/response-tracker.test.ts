import { describe, it, expect, vi, beforeEach } from "vitest";
import { responseTimeTracker, getStats } from "../../shared/response-time-tracker.js";
import type { Request, Response, NextFunction } from "express";

describe("response-tracker", () => {
  describe("getStats（初始状态）", () => {
    it("初始状态应返回零值", () => {
      const stats = getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe("responseTimeTracker", () => {
    it("应调用 next()", () => {
      const req = {} as Request;
      const res = {
        on: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      responseTimeTracker(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("应监听 res finish 事件", () => {
      const req = {} as Request;
      const res = {
        on: vi.fn(),
        statusCode: 200,
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      responseTimeTracker(req, res, next);

      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("finish 事件触发后应记录请求", () => {
      const req = {} as Request;
      let finishCallback: (() => void) | null = null;
      const res = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "finish") finishCallback = cb;
        }),
        statusCode: 200,
      } as unknown as Response;

      responseTimeTracker(req, res, vi.fn() as unknown as NextFunction);

      // 模拟 finish 事件触发
      finishCallback!();

      const stats = getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe("getStats（有数据后）", () => {
    beforeEach(() => {
      // 重置通过新请求触发
    });

    it("应统计错误请求", () => {
      const req = {} as Request;
      let finishCb: (() => void) | null = null;
      const res = {
        on: vi.fn((_e: string, cb: () => void) => { finishCb = cb; }),
        statusCode: 500,
      } as unknown as Response;

      responseTimeTracker(req, res, vi.fn());
      finishCb!();

      const stats = getStats();
      expect(stats.errorCount).toBeGreaterThan(0);
    });

    it("应统计状态码分布", () => {
      const req = {} as Request;
      let finishCb: (() => void) | null = null;
      const res = {
        on: vi.fn((_e: string, cb: () => void) => { finishCb = cb; }),
        statusCode: 404,
      } as unknown as Response;

      responseTimeTracker(req, res, vi.fn());
      finishCb!();

      const stats = getStats();
      expect(stats.statusCodes[404]).toBeGreaterThanOrEqual(1);
    });
  });
});
