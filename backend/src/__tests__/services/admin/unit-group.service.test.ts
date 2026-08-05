/**
 * 单位组 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/unit-group.service.ts
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

import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} from "../../../services/admin/unit-group.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("unit-group.service - listGroups", () => {
  it("无筛选时按租户查询并加载每组明细", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1, name: "箱组", status: 1 }])
      .mockResolvedValueOnce([{ id: 10, group_id: 1, name: "箱", level: 1, conversion_rate: "1", status: 1 }]);
    const res = await listGroups("t1");
    expect(res).toEqual([
      {
        id: 1,
        name: "箱组",
        status: 1,
        items: [{ id: 10, name: "箱", level: 1, conversionRate: 1, status: 1 }],
      },
    ]);
  });

  it("keyword/status 筛选条件拼接", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await listGroups("t1", { keyword: "箱", status: "active" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("name LIKE ?");
    expect(sql).toContain("status = 1");
    await listGroups("t1", { status: "inactive" });
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("status = 0");
  });
});

describe("unit-group.service - getGroup", () => {
  it("单位组不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getGroup(1, "t1")).rejects.toMatchObject({ statusCode: 404, message: "单位组不存在" });
  });

  it("返回单位组及明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "箱组", status: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 10, name: "箱", level: 1, conversion_rate: "2", status: 1 }]);
    const res = await getGroup(1, "t1");
    expect(res.items).toEqual([{ id: 10, name: "箱", level: 1, conversionRate: 2, status: 1 }]);
  });
});

describe("unit-group.service - createGroup", () => {
  it("无明细时只创建组", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 5 });
    const res = await createGroup({ name: "组A", items: [] }, "t1");
    expect(res).toEqual({ id: 5 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("含明细时先建组再逐条插入明细", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce({ insertId: 6 })
      .mockResolvedValue({ insertId: 1 });
    const res = await createGroup(
      { name: "组B", items: [{ name: "箱", level: 1, conversionRate: 1, status: 1 }] },
      "t1"
    );
    expect(res).toEqual({ id: 6 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

describe("unit-group.service - updateGroup", () => {
  it("单位组不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateGroup(1, { name: "新" }, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("更新名称/状态并重建明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateGroup(1, { name: "新组", status: 0, items: [{ name: "瓶", level: 2, conversionRate: 2, status: 1 }] }, "t1");
    expect(res).toEqual({ id: 1 });
    const calls = mocks.queryWithTenant.mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain("UPDATE t_unit_group SET name = ?, status = ?");
    expect(calls[1]).toContain("DELETE FROM t_unit_group_item");
    expect(calls[2]).toContain("INSERT INTO t_unit_group_item");
  });

  it("只更新名称不触碰明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await updateGroup(1, { name: "仅改名" }, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });
});

describe("unit-group.service - deleteGroup", () => {
  it("单位组不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteGroup(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("成功删除并返回 id", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteGroup(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_unit_group");
  });
});
