/**
 * 管理端错误日志 service 单元测试
 * 被测文件：src/services/admin/error-log.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: mocks.loggerError },
}));

import { insertErrorLog, listErrorLogs, cleanupOldLogs } from "../../../services/admin/error-log.service";

describe("error-log.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("insertErrorLog", () => {
    it("正常写入错误日志（含全部字段）", async () => {
      mocks.query.mockResolvedValue(undefined);
      await insertErrorLog({
        error_type: "TypeError",
        severity: "ERROR",
        message: "boom",
        stack: "s",
        request_url: "/api/x",
        request_method: "GET",
        status_code: 500,
        user_id: "1",
        tenant_id: "t1",
        source: "backend",
      });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO t_error_logs");
      expect(params).toEqual(["TypeError", "ERROR", "boom", "s", "/api/x", "GET", 500, "1", "t1", "backend"]);
      expect(mocks.loggerError).not.toHaveBeenCalled();
    });

    it("可选字段缺失时使用 null/默认值", async () => {
      mocks.query.mockResolvedValue(undefined);
      await insertErrorLog({ error_type: "T", severity: "WARN", message: "m" });
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["T", "WARN", "m", null, null, null, null, null, null, "backend"]);
    });

    it("DB 写入失败时静默并记录日志不抛错", async () => {
      mocks.query.mockRejectedValue(new Error("DB down"));
      await expect(insertErrorLog({ error_type: "T", severity: "FATAL", message: "m" })).resolves.toBeUndefined();
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("listErrorLogs", () => {
    it("无筛选条件返回分页数据", async () => {
      mocks.query.mockResolvedValue([{ id: 1 }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listErrorLogs({ page: 1, pageSize: 10 });
      expect(res.items.length).toBe(1);
      expect(res.total).toBe(1);
      const [sql] = mocks.query.mock.calls[0];
      expect(sql).not.toContain("WHERE");
    });

    it("带全部筛选条件", async () => {
      mocks.query.mockResolvedValue([]);
      mocks.queryOne.mockResolvedValue({ total: 0 });
      await listErrorLogs({
        error_type: "T", severity: "ERROR", source: "frontend", keyword: "kw", page: 2, pageSize: 5,
      });
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("error_type = ?");
      expect(sql).toContain("severity = ?");
      expect(sql).toContain("source = ?");
      expect(sql).toContain("LIKE");
      expect(params).toEqual(["T", "ERROR", "frontend", "%kw%", "%kw%", 5, 5]);
    });

    it("countResult 为 null 时 total 归零", async () => {
      mocks.query.mockResolvedValue([]);
      mocks.queryOne.mockResolvedValue(null);
      const res = await listErrorLogs({ page: 1, pageSize: 10 });
      expect(res.total).toBe(0);
    });
  });

  describe("cleanupOldLogs", () => {
    it("返回受影响行数", async () => {
      mocks.queryOne.mockResolvedValue({ affectedRows: 50 });
      const res = await cleanupOldLogs(30);
      expect(res).toBe(50);
      const [sql, params] = mocks.queryOne.mock.calls[0];
      expect(sql).toContain("DELETE FROM t_error_logs");
      expect(params).toEqual([30]);
    });

    it("未传 retainDays 时默认 30", async () => {
      mocks.queryOne.mockResolvedValue({ affectedRows: 0 });
      const res = await cleanupOldLogs();
      expect(res).toBe(0);
      const [, params] = mocks.queryOne.mock.calls[0];
      expect(params).toEqual([30]);
    });

    it("返回值为 null 时归零", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await cleanupOldLogs(60);
      expect(res).toBe(0);
    });
  });
});
