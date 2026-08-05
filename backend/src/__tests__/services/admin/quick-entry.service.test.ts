/**
 * 快捷入口 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/quick-entry.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
}));

import {
  listQuickEntries,
  createQuickEntry,
  updateQuickEntry,
  deleteQuickEntry,
  sortQuickEntries,
} from "../../../services/admin/quick-entry.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("quick-entry.service - listQuickEntries", () => {
  it("未指定角色时直接返回全部记录", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "收银" }]);
    const res = await listQuickEntries("t1");
    expect(res).toEqual([{ id: 1, name: "收银" }]);
  });

  it("指定角色时过滤不可见入口（visibleRoles 为空数组视为全部可见）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, visibleRoles: null },
      { id: 2, visibleRoles: ["admin"] },
      { id: 3, visibleRoles: ["cashier"] },
      { id: 4, visibleRoles: JSON.stringify(["admin"]) },
      { id: 5, visibleRoles: "invalid-json" },
      { id: 6, visibleRoles: [] },
    ]);
    const res = await listQuickEntries("t1", "admin");
    const ids = (res as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toEqual([1, 2, 4, 5, 6]);
  });
});

describe("quick-entry.service - createQuickEntry", () => {
  it("成功创建，排序值取 nextOrder，enabled 缺省为 1", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ nextOrder: 4 });
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 10 }]);
    const res = await createQuickEntry("t1", { name: "销售单", icon: "i", route: "/r" });
    expect(res).toEqual({ id: 10 });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain(1);
    expect(params).toContain(4);
  });

  it("nextOrder 缺失时兜底 1，enabled=false 时写入 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 11 }]);
    await createQuickEntry("t1", { name: "X", icon: "i", route: "/x", enabled: false, visibleRoles: ["admin"] });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain(0);
    expect(params).toContain(1);
    expect(params).toContain('["admin"]');
  });
});

describe("quick-entry.service - updateQuickEntry", () => {
  it("无字段变更时返回 updated:false", async () => {
    const res = await updateQuickEntry("t1", 1, {});
    expect(res).toEqual({ updated: false });
    expect(mocks.executeWithTenant).not.toHaveBeenCalled();
  });

  it("部分字段更新成功，enabled 转 1/0，visibleRoles 转 JSON", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await updateQuickEntry("t1", 1, { name: "新", enabled: false, visibleRoles: ["cashier"] });
    expect(res).toEqual({ updated: true });
    const sql = String(mocks.executeWithTenant.mock.calls[0][0]);
    const params = mocks.executeWithTenant.mock.calls[0][1] as unknown[];
    expect(sql).toContain("SET name = ?, enabled = ?, visible_roles = ?");
    expect(params).toEqual(["新", 0, '["cashier"]', 1, "t1"]);
  });
});

describe("quick-entry.service - deleteQuickEntry / sortQuickEntries", () => {
  it("删除成功返回 deleted:true", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await deleteQuickEntry("t1", 5);
    expect(res).toEqual({ deleted: true });
    expect(mocks.executeWithTenant.mock.calls[0][1]).toEqual([5, "t1"]);
  });

  it("排序按数组顺序逐条更新", async () => {
    mocks.executeWithTenant.mockResolvedValue(undefined);
    const res = await sortQuickEntries("t1", [3, 1, 2]);
    expect(res).toEqual({ sorted: true });
    expect(mocks.executeWithTenant).toHaveBeenCalledTimes(3);
    expect(mocks.executeWithTenant.mock.calls[0][1]).toEqual([0, 3, "t1"]);
    expect(mocks.executeWithTenant.mock.calls[2][1]).toEqual([2, 2, "t1"]);
  });
});
