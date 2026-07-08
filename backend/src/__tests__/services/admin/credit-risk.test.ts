/**
 * 管理端信用风险 service 单元测试
 * 被测文件：src/services/admin/credit-risk.service.ts
 * 覆盖全部 1 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import { getRiskCustomers } from "../../../services/admin/credit-risk.service.js";

const ctx = { tenantId: "t1", userId: 1, username: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ getRiskCustomers ============
describe("admin credit-risk.service - getRiskCustomers", () => {
  it("total 有值时返回正确总数", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三", riskLevel: "WARNING" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getRiskCustomers(1, 10, ctx);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ customerId: 1, customerName: "张三", riskLevel: "WARNING" }] });
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getRiskCustomers(2, 5, ctx);
    expect(res.total).toBe(0);
    expect(res.page).toBe(2);
    expect(res.pageSize).toBe(5);
  });
});
