/**
 * 慢查询监控中间件单元测试
 * 被测文件：src/middleware/slow-query-monitor.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { warn: loggerMock.warn },
}));

import {
  recordQueryExecution,
  getSlowQueries,
  clearSlowQueries,
  slowQueryMiddleware,
} from "../../middleware/slow-query-monitor";

describe("slow-query-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSlowQueries();
  });

  describe("recordQueryExecution", () => {
    it("超过阈值的查询应记录并输出 warn 日志", () => {
      recordQueryExecution("SELECT * FROM t_user", [1], 1500);
      const queries = getSlowQueries();
      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toBe("SELECT * FROM t_user");
      expect(queries[0].params).toEqual([1]);
      expect(queries[0].duration).toBe(1500);
      expect(typeof queries[0].timestamp).toBe("string");
      expect(loggerMock.warn).toHaveBeenCalledTimes(1);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("[slow-query]")
      );
    });

    it("未超过阈值的查询不应记录", () => {
      recordQueryExecution("SELECT * FROM t_user", [1], 500);
      expect(getSlowQueries()).toHaveLength(0);
      expect(loggerMock.warn).not.toHaveBeenCalled();
    });

    it("恰好等于阈值的不应记录", () => {
      recordQueryExecution("SELECT 1", [], 1000);
      expect(getSlowQueries()).toHaveLength(0);
      expect(loggerMock.warn).not.toHaveBeenCalled();
    });

    it("记录多条慢查询", () => {
      recordQueryExecution("SELECT 1", [1], 1100);
      recordQueryExecution("SELECT 2", [2], 1200);
      recordQueryExecution("SELECT 3", [3], 1300);
      const queries = getSlowQueries();
      expect(queries).toHaveLength(3);
      expect(queries[0].sql).toBe("SELECT 1");
      expect(queries[2].sql).toBe("SELECT 3");
    });

    it("超过 100 条时只保留最近 100 条", () => {
      for (let i = 0; i < 105; i++) {
        recordQueryExecution(`SELECT ${i}`, [i], 1001 + i);
      }
      const queries = getSlowQueries();
      expect(queries).toHaveLength(100);
      // 最早 5 条被移除，第一条是 SELECT 5
      expect(queries[0].sql).toBe("SELECT 5");
      expect(queries[99].sql).toBe("SELECT 104");
    });

    it("慢查询记录包含完整字段", () => {
      recordQueryExecution("SELECT * FROM t_orders WHERE id = ?", [42], 2500);
      const record = getSlowQueries()[0];
      expect(record).toHaveProperty("sql");
      expect(record).toHaveProperty("params");
      expect(record).toHaveProperty("duration");
      expect(record).toHaveProperty("timestamp");
      expect(record.sql).toBe("SELECT * FROM t_orders WHERE id = ?");
      expect(record.params).toEqual([42]);
      expect(record.duration).toBe(2500);
    });
  });

  describe("getSlowQueries", () => {
    it("初始状态返回空数组", () => {
      expect(getSlowQueries()).toEqual([]);
    });

    it("返回数组副本，修改不影响内部状态", () => {
      recordQueryExecution("SELECT 1", [], 2000);
      const queries = getSlowQueries();
      queries.push({
        sql: "fake",
        params: [],
        duration: 0,
        timestamp: "",
      });
      expect(getSlowQueries()).toHaveLength(1);
    });
  });

  describe("clearSlowQueries", () => {
    it("清空所有慢查询记录", () => {
      recordQueryExecution("SELECT 1", [], 2000);
      recordQueryExecution("SELECT 2", [], 3000);
      expect(getSlowQueries()).toHaveLength(2);
      clearSlowQueries();
      expect(getSlowQueries()).toHaveLength(0);
    });
  });

  describe("slowQueryMiddleware", () => {
    it("应调用 next()", () => {
      const req = { method: "GET", url: "/test" } as unknown as Request;
      const res = { on: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      slowQueryMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("应监听 res finish 事件", () => {
      const req = { method: "GET", url: "/test" } as unknown as Request;
      const res = { on: vi.fn() } as unknown as Response;

      slowQueryMiddleware(req, res, vi.fn());
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("请求耗时超过阈值时输出 warn 日志", () => {
      const dateSpy = vi.spyOn(Date, "now");
      dateSpy.mockReturnValueOnce(0); // 中间件启动时间
      dateSpy.mockReturnValueOnce(1500); // finish 时的时间

      const req = { method: "GET", url: "/slow-request" } as unknown as Request;
      let finishCallback: (() => void) | null = null;
      const res = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "finish") finishCallback = cb;
        }),
      } as unknown as Response;

      slowQueryMiddleware(req, res, vi.fn());
      finishCallback!();

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("[slow-request]")
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("/slow-request")
      );
      dateSpy.mockRestore();
    });

    it("请求耗时未超过阈值时不输出 warn 日志", () => {
      const dateSpy = vi.spyOn(Date, "now");
      dateSpy.mockReturnValueOnce(0); // 启动时间
      dateSpy.mockReturnValueOnce(500); // finish 时间（仅 500ms）

      const req = { method: "GET", url: "/fast-request" } as unknown as Request;
      let finishCallback: (() => void) | null = null;
      const res = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "finish") finishCallback = cb;
        }),
      } as unknown as Response;

      slowQueryMiddleware(req, res, vi.fn());
      finishCallback!();

      // slow-request 的 warn 不应被调用（但此前的 slow-query 测试可能调用了）
      // 这里只检查最近的调用不含 /fast-request
      const calls = loggerMock.warn.mock.calls;
      const hasFastRequest = calls.some((c: unknown[]) =>
        String(c[0]).includes("/fast-request")
      );
      expect(hasFastRequest).toBe(false);
      dateSpy.mockRestore();
    });
  });
});
