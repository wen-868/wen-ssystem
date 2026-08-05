/**
 * 计量单位 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/unit.service.ts
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

import { list, create, update, remove } from "../../../services/admin/unit.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("unit.service - list", () => {
  it("无关键字时仅按租户查询并排序", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "箱" }]);
    const res = await list({ tenantId: "t1" });
    expect(res).toEqual([{ id: 1, name: "箱" }]);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("ORDER BY sort_no ASC, id ASC");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["t1"]);
  });

  it("有关键字时追加 name/code 模糊匹配", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await list({ keyword: "瓶", tenantId: "t1" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(sql).toContain("(name LIKE ? OR code LIKE ?)");
    expect(params).toEqual(["t1", "%瓶%", "%瓶%"]);
  });
});

describe("unit.service - create", () => {
  it("type/sortNo 缺省时使用默认值 BASE/0", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
    const res = await create({ name: "瓶", code: "BOTTLE" }, "t1");
    expect(res).toEqual({ id: 11 });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toEqual(["瓶", "BOTTLE", "BASE", 0, "t1"]);
  });

  it("传入 type/sortNo 时使用传入值", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 12 });
    await create({ name: "箱", code: "BOX", type: "PACKAGE", sortNo: 2 }, "t1");
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toEqual(["箱", "BOX", "PACKAGE", 2, "t1"]);
  });
});

describe("unit.service - update", () => {
  it("单位不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(update(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404, message: "单位不存在" });
  });

  it("无字段变更时直接返回 id 不执行 UPDATE", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await update(1, {}, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("部分字段更新时拼接 SET 并带 id/tenant 条件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await update(1, { name: "新名", sortNo: 5 }, "t1");
    expect(res).toEqual({ id: 1 });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("SET name = ?, sort_no = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["新名", 5, 1, "t1"]);
  });
});

describe("unit.service - remove", () => {
  it("单位不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(remove(1, "t1")).rejects.toMatchObject({ statusCode: 404, message: "单位不存在" });
  });

  it("成功删除并返回 id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await remove(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([1, "t1"]);
  });
});
