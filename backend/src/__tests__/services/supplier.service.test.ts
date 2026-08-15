import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

vi.mock("../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { supplierService } from "../../services/supplier.service";

describe("supplier.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("GYS20260815001");
  });

  it("getPageList：分页供应商列表（并联联系人）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ total: 1 }]) // COUNT
      .mockResolvedValueOnce([{ id: 1, name: "茅台供应商", contact_person: "李四" }]); // 数据
    const result = await supplierService.getPageList(undefined, undefined, undefined, 1, 20, { tenantId: "t1" } as any);
    expect(result.total).toBe(1);
    expect(result.records[0].name).toBe("茅台供应商");
  });

  it("getDetail：返回供应商详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, name: "茅台供应商" });
    mocks.query.mockResolvedValueOnce([]); // 联系人列表
    const detail = await supplierService.getDetail(1, { tenantId: "t1" } as any);
    expect(detail?.name).toBe("茅台供应商");
  });

  it("create：创建供应商", async () => {
    const conn = { execute: vi.fn(), query: vi.fn() };
    conn.execute.mockResolvedValueOnce({ insertId: 9 }); // INSERT 供应商
    conn.execute.mockResolvedValueOnce({ affectedRows: 1 }); // INSERT 操作日志
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // 编码冲突检查

    const result = await supplierService.create(
      { name: "新供应商", category: "白酒", contactName: "王五", contactMobile: "13900000000" } as any,
      { tenantId: "t1", userId: 1, username: "管理员" } as any
    );
    expect(result.id).toBe(9);
    expect(result.supplierCode).toBe("GYS20260815001");
  });
});
