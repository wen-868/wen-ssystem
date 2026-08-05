/**
 * 审计日志 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/audit.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  poolQuery: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  pool: { query: mocks.poolQuery },
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}));

import { listAuditLogs, getAuditStatistics, writeAuditLog } from "../../../services/admin/audit.service";

function mockReq(partial: Partial<Request> = {}): Request {
  return {
    ip: "::ffff:127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" } as unknown as Request["socket"],
    headers: { "user-agent": "vitest" },
    ...partial,
  } as unknown as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("audit.service - listAuditLogs", () => {
  it("仅按租户查询，total 缺失兜底 0", async () => {
    mocks.queryOne.mockResolvedValue({ total: 3 });
    mocks.query.mockResolvedValue([{ id: 1 }]);
    const res = await listAuditLogs({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 3, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("传入 userId/action/resourceType/日期时拼接全部条件", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue([]);
    const res = await listAuditLogs({
      page: 2,
      pageSize: 5,
      tenantId: "t1",
      userId: 9,
      action: "login",
      resourceType: "member",
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
    });
    expect(res.total).toBe(0);
    const sql = String(mocks.queryOne.mock.calls[0][0]);
    expect(sql).toContain("user_id = ?");
    expect(sql).toContain("action = ?");
    expect(sql).toContain("resource_type = ?");
    expect(sql).toContain("DATE(created_at) >= ?");
    expect(sql).toContain("DATE(created_at) <= ?");
  });
});

describe("audit.service - getAuditStatistics", () => {
  it("今日/本周/本月计数与分布全部返回", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ cnt: 1 })
      .mockResolvedValueOnce({ cnt: 2 })
      .mockResolvedValueOnce(null);
    mocks.query
      .mockResolvedValueOnce([{ action: "login", cnt: 2 }])
      .mockResolvedValueOnce([{ userName: "张三", cnt: 1 }]);
    const res = await getAuditStatistics("t1");
    expect(res).toEqual({
      todayCount: 1,
      weekCount: 2,
      monthCount: 0,
      actionDistribution: [{ action: "login", cnt: 2 }],
      userDistribution: [{ userName: "张三", cnt: 1 }],
    });
  });
});

describe("audit.service - writeAuditLog", () => {
  it("成功写入时返回 undefined，IP 去除 ::ffff: 前缀", () => {
    mocks.poolQuery.mockResolvedValue([{ insertId: 1 }]);
    writeAuditLog({
      userId: 1,
      userName: "张三",
      role: "admin",
      action: "login",
      resourceType: "member",
      tenantId: 1,
      req: mockReq(),
    });
    expect(mocks.poolQuery).toHaveBeenCalledOnce();
    const params = mocks.poolQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("127.0.0.1");
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("写入失败时记录错误日志", async () => {
    mocks.poolQuery.mockRejectedValue(new Error("db down"));
    writeAuditLog({
      userId: 1,
      userName: "张三",
      role: "admin",
      action: "login",
      resourceType: "member",
      tenantId: 1,
      req: mockReq({ ip: undefined, headers: {} }),
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("resourceId/detail 缺省时写入 null", () => {
    mocks.poolQuery.mockResolvedValue([{ insertId: 1 }]);
    writeAuditLog({
      userId: 2,
      userName: "李四",
      role: "store",
      action: "create",
      resourceType: "order",
      tenantId: 2,
      req: mockReq(),
    });
    const params = mocks.poolQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(null);
  });
});
