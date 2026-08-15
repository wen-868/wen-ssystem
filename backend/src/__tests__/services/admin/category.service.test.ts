import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  cacheGet: vi.fn(),
  cacheDelPattern: vi.fn(),
  syncChangedFields: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/redis-cache", () => ({
  cacheGet: mocks.cacheGet,
  cacheDelPattern: mocks.cacheDelPattern,
}));

vi.mock("../../../shared/field-sync", () => ({
  syncChangedFields: mocks.syncChangedFields,
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { list, create, remove } from "../../../services/admin/category.service";

describe("admin/category.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("list：带筛选条件时直查不缓存", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, name: "白酒" }]);
    const result = await list({ status: 1, tenantId: "t1" });
    expect(result[0].name).toBe("白酒");
    expect(mocks.cacheGet).not.toHaveBeenCalled();
  });

  it("list：无筛选时走缓存", async () => {
    mocks.cacheGet.mockImplementationOnce(async (_k: string, fn: () => unknown) => fn());
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, name: "白酒" }]);
    const result = await list({ tenantId: "t1" });
    expect(result[0].name).toBe("白酒");
    expect(mocks.cacheGet).toHaveBeenCalled();
  });

  it("create：创建分类并清缓存", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 3 });
    mocks.cacheDelPattern.mockResolvedValueOnce(undefined);
    const result = await create({ name: "红酒", sortNo: 1 }, "t1");
    expect(result.id).toBe(3);
    expect(mocks.cacheDelPattern).toHaveBeenCalled();
  });

  it("remove：删除分类并清缓存", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 5 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ cnt: 0 }]); // 子分类检查
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.cacheDelPattern.mockResolvedValueOnce(undefined);
    await remove(5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_product_category"),
      expect.any(Array),
      "t1"
    );
  });
});
