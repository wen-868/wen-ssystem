import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  createFullReduction,
  listFullReductions,
  getFullReduction,
  deleteFullReduction,
  activateFullReduction,
  pauseFullReduction,
} from "../../../services/admin/marketing-full-reduction.service";

const tenantId = "t1";

function mockRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "满100减20",
    rules: "[{\"minAmount\":100,\"reduceAmount\":20}]",
    applicableScope: "ALL",
    applicableIds: "null",
    startTime: "2026-01-01",
    endTime: "2026-12-31",
    status: "DRAFT",
    priority: 10,
    stackable: 0,
    description: "",
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-full-reduction.service - 满减规则", () => {
  it("createFullReduction 插入后返回最新规则", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue(mockRule());
    const res = await createFullReduction({
      name: "满100减20", rules: [{ minAmount: 100, reduceAmount: 20 }],
      applicableScope: "ALL", applicableIds: null,
      startTime: "2026-01-01", endTime: "2026-12-31",
      priority: 10, stackable: false, description: "",
    }, tenantId);
    expect(res.name).toBe("满100减20");
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_full_reduction");
    expect(params[1]).toContain("minAmount");
  });

  it("listFullReductions 无状态筛选分页返回", async () => {
    mocks.queryWithTenant.mockResolvedValue([mockRule()]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listFullReductions(1, 20, tenantId);
    expect(res.total).toBe(1);
    expect(res.records[0].name).toBe("满100减20");
  });

  it("listFullReductions 带状态筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listFullReductions(1, 20, tenantId, "ACTIVE");
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("status = ?");
  });

  it("getFullReduction 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getFullReduction(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it("deleteFullReduction 删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteFullReduction(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_full_reduction");
  });

  it("activate/pause 更新状态", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "DRAFT" })
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await activateFullReduction(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = 'ACTIVE'");
    await pauseFullReduction(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("status = 'PAUSED'");
  });
});
