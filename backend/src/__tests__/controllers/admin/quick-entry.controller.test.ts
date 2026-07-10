/**
 * 管理端快捷入口 controller 单元测试
 * 被测文件：src/controllers/admin/quick-entry.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listQuickEntries: vi.fn(),
  createQuickEntry: vi.fn(),
  updateQuickEntry: vi.fn(),
  deleteQuickEntry: vi.fn(),
  sortQuickEntries: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/quick-entry.service.js", () => ({
  listQuickEntries: mocks.listQuickEntries,
  createQuickEntry: mocks.createQuickEntry,
  updateQuickEntry: mocks.updateQuickEntry,
  deleteQuickEntry: mocks.deleteQuickEntry,
  sortQuickEntries: mocks.sortQuickEntries,
}));

import {
  listQuickEntries,
  createQuickEntry,
  updateQuickEntry,
  deleteQuickEntry,
  sortQuickEntries,
} from "../../../controllers/admin/quick-entry.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin quick-entry.controller", () => {
  it("listQuickEntries 不传 role 时为 undefined", async () => {
    mocks.listQuickEntries.mockResolvedValue([{ id: 1, name: "入口A" }]);
    const req = mockReq();
    const res = mockRes();
    await listQuickEntries(req, res);
    expect(mocks.listQuickEntries).toHaveBeenCalledWith("t1", undefined);
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, name: "入口A" }]);
  });

  it("listQuickEntries 传入 role 筛选", async () => {
    mocks.listQuickEntries.mockResolvedValue([]);
    const req = mockReq({ query: { role: "admin" } });
    const res = mockRes();
    await listQuickEntries(req, res);
    expect(mocks.listQuickEntries).toHaveBeenCalledWith("t1", "admin");
  });

  it("createQuickEntry 成功创建并使用默认 enabled", async () => {
    mocks.createQuickEntry.mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "入口", icon: "icon-home", route: "/home" } });
    const res = mockRes();
    await createQuickEntry(req, res);
    expect(mocks.createQuickEntry).toHaveBeenCalledWith("t1", expect.objectContaining({
      name: "入口", icon: "icon-home", route: "/home", enabled: true,
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createQuickEntry 传入 visibleRoles 和 group", async () => {
    mocks.createQuickEntry.mockResolvedValue({ id: 2 });
    const req = mockReq({ body: { name: "入口B", icon: "icon-2", route: "/b", group: "常用", enabled: false, visibleRoles: ["admin", "staff"] } });
    const res = mockRes();
    await createQuickEntry(req, res);
    expect(mocks.createQuickEntry).toHaveBeenCalledWith("t1", expect.objectContaining({
      group: "常用", enabled: false, visibleRoles: ["admin", "staff"],
    }));
  });

  it("updateQuickEntry 传入 id 转换为数字", async () => {
    mocks.updateQuickEntry.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "5" }, body: { name: "新名称", enabled: false } });
    const res = mockRes();
    await updateQuickEntry(req, res);
    expect(mocks.updateQuickEntry).toHaveBeenCalledWith("t1", 5, expect.objectContaining({
      name: "新名称", enabled: false,
    }));
  });

  it("deleteQuickEntry 传入 id 转换为数字", async () => {
    mocks.deleteQuickEntry.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "8" } });
    const res = mockRes();
    await deleteQuickEntry(req, res);
    expect(mocks.deleteQuickEntry).toHaveBeenCalledWith("t1", 8);
    expect(mocks.ok).toHaveBeenCalledWith({ success: true });
  });

  it("sortQuickEntries 传入 ids 数组", async () => {
    mocks.sortQuickEntries.mockResolvedValue({ success: true });
    const req = mockReq({ body: { ids: [3, 1, 2] } });
    const res = mockRes();
    await sortQuickEntries(req, res);
    expect(mocks.sortQuickEntries).toHaveBeenCalledWith("t1", [3, 1, 2]);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });

  it("createQuickEntry 调用 res.json 返回 ok 包装结果", async () => {
    mocks.createQuickEntry.mockResolvedValue({ id: 10 });
    const req = mockReq({ body: { name: "入口", icon: "i", route: "/r" } });
    const res = mockRes();
    await createQuickEntry(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 10 } });
  });

  it("listQuickEntries 调用 res.json 返回 ok 包装结果", async () => {
    mocks.listQuickEntries.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listQuickEntries(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
});
