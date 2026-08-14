import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  toggleTenantStatus,
} from "../../services/platform-tenant.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("platform-tenant.service - 平台租户管理", () => {
  it("listTenants 无关键词返回全量分页", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([{ id: 1, tenantName: "酒行A" }]);
    const res = await listTenants(1, 20);
    expect(res.total).toBe(1);
    expect(res.records[0].tenantName).toBe("酒行A");
    expect(mocks.query.mock.calls[0][0]).toContain("LIMIT ? OFFSET ?");
  });

  it("listTenants 带关键词时拼接 LIKE 条件", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    mocks.query.mockResolvedValue([]);
    await listTenants(2, 10, "酒");
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("tenant_name LIKE ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["%酒%", 10, 10]);
  });

  it("getTenantById 返回租户详情", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, tenantName: "酒行A", status: "ACTIVE" });
    const res = await getTenantById(1);
    expect(res?.tenantName).toBe("酒行A");
  });

  it("checkTenantNameExists 命中返回 true，未命中 false", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 });
    expect(await checkTenantNameExists("酒行A")).toBe(true);
    mocks.queryOne.mockResolvedValueOnce(null);
    expect(await checkTenantNameExists("不存在")).toBe(false);
  });

  it("toggleTenantStatus 更新状态", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await toggleTenantStatus(1, "SUSPENDED");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("UPDATE t_tenant");
    expect(params).toEqual(["SUSPENDED", 1]);
  });
});
