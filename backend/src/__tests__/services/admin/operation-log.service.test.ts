/**
 * 操作日志 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/operation-log.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listLogs, getStatistics } from "../../../services/admin/operation-log.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("operation-log.service - listLogs", () => {
  it("仅按租户查询时 conditions 只有 tenant_id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await listLogs("t1", { page: 1, pageSize: 10 });
    expect(res).toEqual({ total: 5, page: 1, pageSize: 10, records: [{ id: 1 }] });
    expect(String(mocks.queryOneWithTenant.mock.calls[0][0])).toContain("WHERE tenant_id = ?");
  });

  it("传入全部筛选条件时拼接 module/action/operatorName/bizNo/日期", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await listLogs("t1", {
      page: 2,
      pageSize: 5,
      module: "sale",
      action: "create",
      operatorName: "张三",
      bizNo: "XS001",
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
    });
    const sql = String(mocks.queryOneWithTenant.mock.calls[0][0]);
    expect(sql).toContain("module = ?");
    expect(sql).toContain("action = ?");
    expect(sql).toContain("operator_name LIKE ?");
    expect(sql).toContain("biz_no = ?");
    expect(sql).toContain("DATE(created_at) >= ?");
    expect(sql).toContain("DATE(created_at) <= ?");
  });

  it("total 行不存在时兜底 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await listLogs("t1", { page: 1, pageSize: 10 });
    expect(res.total).toBe(0);
  });
});

describe("operation-log.service - getStatistics", () => {
  it("今日/本周计数缺失时兜底 0，分布使用查询结果", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 3 })
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ module: "sale", cnt: 2 }])
      .mockResolvedValueOnce([{ action: "create", cnt: 1 }]);
    const res = await getStatistics("t1");
    expect(res).toEqual({
      todayCount: 3,
      weekCount: 0,
      moduleDistribution: [{ module: "sale", cnt: 2 }],
      actionDistribution: [{ action: "create", cnt: 1 }],
    });
  });

  it("全部查询为空时返回全 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getStatistics("t1");
    expect(res.todayCount).toBe(0);
    expect(res.weekCount).toBe(0);
    expect(res.moduleDistribution).toEqual([]);
    expect(res.actionDistribution).toEqual([]);
  });
});
