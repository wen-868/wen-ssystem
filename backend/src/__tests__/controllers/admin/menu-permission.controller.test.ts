/**
 * 管理端菜单权限 controller 单元测试
 * 被测文件：src/controllers/admin/menu-permission.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  getMenuTree: vi.fn(),
  getUserMenus: vi.fn(),
  getRolePermissions: vi.fn(),
  setRoleMenuPermissions: vi.fn(),
  getDataPermissions: vi.fn(),
  setRoleDataPermissions: vi.fn(),
  getFieldPermissions: vi.fn(),
  setRoleFieldPermissions: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/menu-permission.service.js", () => ({
  getMenuTree: mocks.getMenuTree,
  getUserMenus: mocks.getUserMenus,
  getRolePermissions: mocks.getRolePermissions,
  setRoleMenuPermissions: mocks.setRoleMenuPermissions,
  getDataPermissions: mocks.getDataPermissions,
  setRoleDataPermissions: mocks.setRoleDataPermissions,
  getFieldPermissions: mocks.getFieldPermissions,
  setRoleFieldPermissions: mocks.setRoleFieldPermissions,
}));

import {
  getMenuTree,
  getUserMenus,
  getRolePermissions,
  setRoleMenuPermissions,
  getDataPermissions,
  setRoleDataPermissions,
  getFieldPermissions,
  setRoleFieldPermissions,
} from "../../../controllers/admin/menu-permission.controller.js";

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

describe("admin menu-permission.controller", () => {
  it("getMenuTree 调用 service 并返回树", async () => {
    mocks.getMenuTree.mockResolvedValue([{ id: 1, name: "菜单" }]);
    const req = mockReq();
    const res = mockRes();
    await getMenuTree(req, res);
    expect(mocks.getMenuTree).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, name: "菜单" }]);
  });

  it("getUserMenus 传入 userId 和 tenantId", async () => {
    mocks.getUserMenus.mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ user: { id: 7, username: "user1" } });
    const res = mockRes();
    await getUserMenus(req, res);
    expect(mocks.getUserMenus).toHaveBeenCalledWith(7, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
  });

  it("getRolePermissions 传入 roleId 转换为数字", async () => {
    mocks.getRolePermissions.mockResolvedValue([{ menuId: 1 }]);
    const req = mockReq({ params: { roleId: "5" } });
    const res = mockRes();
    await getRolePermissions(req, res);
    expect(mocks.getRolePermissions).toHaveBeenCalledWith(5, "t1");
  });

  it("setRoleMenuPermissions 传入 menuIds 并返回 menuCount", async () => {
    mocks.setRoleMenuPermissions.mockResolvedValue(undefined);
    const req = mockReq({ params: { roleId: "3" }, body: { menuIds: [1, 2, 3] } });
    const res = mockRes();
    await setRoleMenuPermissions(req, res);
    expect(mocks.setRoleMenuPermissions).toHaveBeenCalledWith(3, [1, 2, 3], "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ roleId: 3, menuCount: 3 });
  });

  it("getDataPermissions 传入 roleId 转换为数字", async () => {
    mocks.getDataPermissions.mockResolvedValue([{ tableName: "orders" }]);
    const req = mockReq({ params: { roleId: "2" } });
    const res = mockRes();
    await getDataPermissions(req, res);
    expect(mocks.getDataPermissions).toHaveBeenCalledWith(2, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ tableName: "orders" }] });
  });

  it("setRoleDataPermissions 映射 roleId 并返回 count", async () => {
    mocks.setRoleDataPermissions.mockResolvedValue(undefined);
    const req = mockReq({
      params: { roleId: "4" },
      body: { dataPermissions: [{ tableName: "orders", fieldName: "amount", filterType: "DEPT", filterValue: "1" }] },
    });
    const res = mockRes();
    await setRoleDataPermissions(req, res);
    expect(mocks.setRoleDataPermissions).toHaveBeenCalledWith(
      4,
      [expect.objectContaining({ roleId: 4, tableName: "orders" })],
      "t1"
    );
    expect(mocks.ok).toHaveBeenCalledWith({ roleId: 4, count: 1 });
  });

  it("getFieldPermissions 传入 roleId 转换为数字", async () => {
    mocks.getFieldPermissions.mockResolvedValue([{ tableName: "orders", fieldName: "amount" }]);
    const req = mockReq({ params: { roleId: "6" } });
    const res = mockRes();
    await getFieldPermissions(req, res);
    expect(mocks.getFieldPermissions).toHaveBeenCalledWith(6, "t1");
  });

  it("setRoleFieldPermissions 映射 roleId 并返回 count", async () => {
    mocks.setRoleFieldPermissions.mockResolvedValue(undefined);
    const req = mockReq({
      params: { roleId: "7" },
      body: { fieldPermissions: [
        { tableName: "orders", fieldName: "amount", permissionType: "HIDDEN" },
        { tableName: "orders", fieldName: "cost", permissionType: "READONLY" },
      ] },
    });
    const res = mockRes();
    await setRoleFieldPermissions(req, res);
    expect(mocks.setRoleFieldPermissions).toHaveBeenCalledWith(
      7,
      [expect.objectContaining({ roleId: 7 }), expect.objectContaining({ roleId: 7 })],
      "t1"
    );
    expect(mocks.ok).toHaveBeenCalledWith({ roleId: 7, count: 2 });
  });

  it("getMenuTree 调用 res.json 返回 ok 包装结果", async () => {
    mocks.getMenuTree.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getMenuTree(req, res);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
});
