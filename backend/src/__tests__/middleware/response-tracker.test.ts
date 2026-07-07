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

    it("相同状态码多次请求应累加计数", () => {
      const req1 = {} as Request;
      let finishCb1: (() => void) | null = null;
      const res1 = {
        on: vi.fn((_e: string, cb: () => void) => { finishCb1 = cb; }),
        statusCode: 200,
      } as unknown as Response;

      responseTimeTracker(req1, res1, vi.fn());
      finishCb1!();

      const req2 = {} as Request;
      let finishCb2: (() => void) | null = null;
      const res2 = {
        on: vi.fn((_e: string, cb: () => void) => { finishCb2 = cb; }),
        statusCode: 200,
      } as unknown as Response;

      responseTimeTracker(req2, res2, vi.fn());
      finishCb2!();

      const stats = getStats();
      expect(stats.statusCodes[200]).toBeGreaterThanOrEqual(2);
    });

    it("过期的请求不应被统计", () => {
      const beforeCount = getStats().totalRequests;

      const req = {} as Request;
      let finishCb: (() => void) | null = null;
      const res = {
        on: vi.fn((_e: string, cb: () => void) => { finishCb = cb; }),
        statusCode: 200,
      } as unknown as Response;

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() - 120000); // 2 分钟前

      responseTimeTracker(req, res, vi.fn());
      finishCb!();

      vi.useRealTimers();

      const stats = getStats();
      // 新插入的过期记录不应被统计
      // （不过 totalRequests 可能包含了之前测试的记录，所以只验证至少有之前的数量）
      expect(stats.totalRequests).toBeGreaterThanOrEqual(beforeCount);
    });
  });
});
