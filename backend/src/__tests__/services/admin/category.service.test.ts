/**
 * 商品分类 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/category.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  cacheGet: vi.fn(),
  cacheDelPattern: vi.fn(),
  syncChangedFields: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/redis-cache", () => ({
  cacheGet: mocks.cacheGet,
  cacheDelPattern: mocks.cacheDelPattern,
}));

vi.mock("../../../shared/field-sync", () => ({
  syncChangedFields: mocks.syncChangedFields,
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn() },
}));

import { list, clearCategoryCache, create, update, remove, sort } from "../../../services/admin/category.service";

const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("category.service - list", () => {
  it("有筛选条件时不走缓存", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await list({ pid: 0, tenantId: "t1", status: 1, allowOnlineSale: 1 });
    expect(res).toEqual([{ id: 1 }]);
    expect(mocks.cacheGet).not.toHaveBeenCalled();
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("parent_id = ?");
    expect(sql).toContain("allow_online_sale = ?");
    expect(sql).toContain("status = ?");
  });

  it("无筛选条件时走缓存兜底查询", async () => {
    mocks.cacheGet.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    mocks.queryWithTenant.mockResolvedValue([{ id: 2 }]);
    const res = await list({ tenantId: "t1" });
    expect(res).toEqual([{ id: 2 }]);
    expect(mocks.cacheGet).toHaveBeenCalledOnce();
    expect(String(mocks.cacheGet.mock.calls[0][0])).toContain("categories:all");
  });

  it("按 pid 缓存键", async () => {
    mocks.cacheGet.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    mocks.queryWithTenant.mockResolvedValue([]);
    await list({ pid: 5, tenantId: "t1" });
    expect(String(mocks.cacheGet.mock.calls[0][0])).toContain("categories:pid:5");
  });
});

describe("category.service - clearCategoryCache", () => {
  it("按租户清除分类缓存", async () => {
    mocks.cacheDelPattern.mockResolvedValue(undefined);
    await clearCategoryCache("t1");
    expect(mocks.cacheDelPattern).toHaveBeenCalledWith("tenant:t1:categories:*");
  });
});

describe("category.service - create", () => {
  it("成功创建并清除缓存", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 3 });
    mocks.cacheDelPattern.mockResolvedValue(undefined);
    const res = await create({ name: "白酒" }, "t1");
    expect(res).toEqual({ id: 3 });
    expect(mocks.cacheDelPattern).toHaveBeenCalledOnce();
  });
});

describe("category.service - update", () => {
  it("分类不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(update(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404, message: "分类不存在" });
  });

  it("无字段变更时直接返回 id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "旧" });
    const res = await update(1, {}, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("改名称时触发字段同步并清缓存，同步失败记录错误日志", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "旧名" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.cacheDelPattern.mockResolvedValue(undefined);
    mocks.syncChangedFields.mockReturnValue(Promise.reject(new Error("sync failed")));
    const res = await update(1, { name: "新名" }, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.syncChangedFields).toHaveBeenCalledOnce();
    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.loggerError).toHaveBeenCalled();
    expect(mocks.cacheDelPattern).toHaveBeenCalledOnce();
  });

  it("不改名称时不触发字段同步", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "白酒" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.cacheDelPattern.mockResolvedValue(undefined);
    await update(1, { sortNo: 3 }, "t1");
    expect(mocks.syncChangedFields).not.toHaveBeenCalled();
  });
});

describe("category.service - remove", () => {
  it("有子分类时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ cnt: 1 }]);
    await expect(remove(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "请先删除子分类" });
  });

  it("有商品引用时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 2 }]);
    await expect(remove(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "该分类下有商品，无法删除" });
  });

  it("成功删除并清缓存", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    mocks.cacheDelPattern.mockResolvedValue(undefined);
    const res = await remove(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.cacheDelPattern).toHaveBeenCalledOnce();
  });
});

describe("category.service - sort", () => {
  it("事务内逐条更新排序", async () => {
    mockConn.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await sort([{ id: 1, sortNo: 1 }, { id: 2, sortNo: 2 }], "t1");
    expect(res).toEqual({ ok: true });
    expect(mockConn.query).toHaveBeenCalledTimes(2);
  });
});
