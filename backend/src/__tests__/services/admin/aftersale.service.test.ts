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
  listMyAftersales,
  getAftersaleDetail,
  cancelAftersale,
} from "../../../services/admin/aftersale.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aftersale.service - 售后服务（查询与取消）", () => {
  it("listMyAftersales 按客户与状态筛选分页", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, aftersaleNo: "AS1", status: "PENDING" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listMyAftersales({ tenantId, customerId: 9, status: "PENDING", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.records[0].aftersaleNo).toBe("AS1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("a.status = ?");
  });

  it("getAftersaleDetail 存在返回详情，不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ aftersaleNo: "AS1", status: "PENDING" });
    const detail = await getAftersaleDetail("AS1", 9, tenantId);
    expect(detail.status).toBe("PENDING");

    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getAftersaleDetail("AS99", 9, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "售后单不存在" });
  });

  it("cancelAftersale 成功取消", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await cancelAftersale("AS1", 9, tenantId);
    expect(res.message).toBe("售后已取消");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = 'CANCELLED'");
  });

  it("cancelAftersale 非待审核状态抛 400（数组归一化 affectedRows）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(cancelAftersale("AS1", 9, tenantId))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
