/**
 * 客户类型 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/customer-type.service.ts
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

import { list, getById, create, update, remove } from "../../../services/admin/customer-type.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("customer-type.service - list", () => {
  it("无状态筛选时仅按租户查询", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "批发客户" }]);
    const res = await list({ tenantId: "t1" });
    expect(res).toEqual([{ id: 1, name: "批发客户" }]);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("ORDER BY sort ASC, id ASC");
  });

  it("传入 status 时拼接筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await list({ status: 1, tenantId: "t1" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("AND status = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["t1", 1]);
  });
});

describe("customer-type.service - getById", () => {
  it("返回查询结果", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 2, name: "零售客户" });
    const res = await getById(2, "t1");
    expect(res).toEqual({ id: 2, name: "零售客户" });
  });
});

describe("customer-type.service - create", () => {
  it("编码已存在时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    await expect(create({ name: "A", code: "W" }, "t1")).rejects.toMatchObject({ statusCode: 400, message: "类型编码已存在" });
  });

  it("成功创建，sort/status 缺省时用 0/1", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 5 });
    const res = await create({ name: "批发客户", code: "W" }, "t1");
    expect(res).toEqual({ id: 5 });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["批发客户", "W", 0, 1, "t1"]);
  });
});

describe("customer-type.service - update", () => {
  it("类型不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(update(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404, message: "客户类型不存在" });
  });

  it("修改编码且与其他记录冲突时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    await expect(update(1, { code: "W" }, "t1")).rejects.toMatchObject({ statusCode: 400, message: "类型编码已存在" });
  });

  it("无字段变更时直接返回 id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await update(1, {}, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("部分字段更新成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await update(1, { name: "新名", sort: 3 }, "t1");
    expect(res).toEqual({ id: 1 });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("SET name = ?, sort = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["新名", 3, 1, "t1"]);
  });
});

describe("customer-type.service - remove", () => {
  it("类型不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(remove(1, "t1")).rejects.toMatchObject({ statusCode: 404, message: "客户类型不存在" });
  });

  it("成功删除并返回 id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await remove(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_customer_type");
  });
});
