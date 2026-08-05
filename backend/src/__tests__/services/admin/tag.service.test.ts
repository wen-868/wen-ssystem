/**
 * 商品标签 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/tag.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getProductTags,
  setProductTags,
} from "../../../services/admin/tag.service";

const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("tag.service - 标签组", () => {
  it("listGroups 返回标签组列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "档次" }]);
    const res = await listGroups("t1");
    expect(res).toEqual([{ id: 1, name: "档次" }]);
  });

  it("createGroup 成功，isMultiple 缺省为 1", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 2 });
    const res = await createGroup({ name: "档次", code: "GRADE" }, "t1");
    expect(res).toEqual({ id: 2 });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toContain(1);
  });

  it("updateGroup 不存在时抛 404，无字段时直接返回", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateGroup(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404 });
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateGroup(1, {}, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("updateGroup 部分字段更新成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateGroup(1, { name: "新名", isMultiple: false }, "t1");
    expect(res).toEqual({ id: 1 });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("SET name = ?, is_multiple = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["新名", 0, 1]);
  });

  it("deleteGroup 不存在/有标签时抛错，成功时删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteGroup(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ cnt: 2 }]);
    await expect(deleteGroup(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "该标签组下有标签，无法删除" });
    mocks.queryWithTenant.mockResolvedValue([{ cnt: 0 }]);
    const res = await deleteGroup(1, "t1");
    expect(res).toEqual({ id: 1 });
  });
});

describe("tag.service - 标签值", () => {
  it("listTags 无 groupId 时查全部，有 groupId 时筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await listTags(undefined, "t1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).not.toContain("group_id = ?");
    await listTags(3, "t1");
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("group_id = ?");
  });

  it("createTag 成功返回 id", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 9 });
    const res = await createTag({ groupId: 1, name: "高端" }, "t1");
    expect(res).toEqual({ id: 9 });
  });

  it("updateTag 不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateTag(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404, message: "标签不存在" });
  });

  it("deleteTag 有商品引用时抛 400，成功时删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ cnt: 1 }]);
    await expect(deleteTag(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "该标签有商品引用，无法删除" });
    mocks.queryWithTenant.mockResolvedValue([{ cnt: 0 }]);
    const res = await deleteTag(1, "t1");
    expect(res).toEqual({ id: 1 });
  });
});

describe("tag.service - 商品标签关联", () => {
  it("getProductTags 返回关联标签", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "高端" }]);
    const res = await getProductTags(100, "t1");
    expect(res).toEqual([{ id: 1, name: "高端" }]);
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual([100]);
  });

  it("setProductTags 事务内先删后插", async () => {
    mockConn.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await setProductTags(100, [1, 2], "t1");
    expect(res).toEqual({ spuId: 100, tagIds: [1, 2] });
    expect(mockConn.query).toHaveBeenCalledTimes(3);
    expect(String(mockConn.query.mock.calls[0][0])).toContain("DELETE FROM t_product_tag_relation");
  });
});
