import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/rbac.service.js", () => ({
  listRoles: vi.fn(),
  createRole: vi.fn(),
  getRoleDetail: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  getUserRoles: vi.fn(),
  setUserRoles: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as rbacService from "../../services/admin/rbac.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  listRoles,
  createRole,
  getRoleDetail,
  updateRole,
  deleteRole,
  getUserRoles,
  setUserRoles,
} from "../../controllers/rbac.controller.js";

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

describe("rbac.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listRoles - 应返回角色列表", async () => {
    (rbacService.listRoles as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listRoles(req as any, res as any);
    expect(rbacService.listRoles).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createRole - 应创建角色", async () => {
    (rbacService.createRole as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        roleName: "管理员",
        roleCode: "ADMIN",
        description: "系统管理员",
        permissions: ["user:read"],
        dataScope: "ALL",
      },
    });
    const res = mockRes();
    await createRole(req as any, res as any);
    expect(rbacService.createRole).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getRoleDetail - 应返回角色详情", async () => {
    (rbacService.getRoleDetail as any).mockResolvedValue({ id: 1, roleName: "管理员" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getRoleDetail(req as any, res as any);
    expect(rbacService.getRoleDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateRole - 应更新角色", async () => {
    (rbacService.updateRole as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { roleName: "更新后的角色" } });
    const res = mockRes();
    await updateRole(req as any, res as any);
    expect(rbacService.updateRole).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteRole - 应删除角色", async () => {
    (rbacService.deleteRole as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteRole(req as any, res as any);
    expect(rbacService.deleteRole).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getUserRoles - 应返回用户角色", async () => {
    (rbacService.getUserRoles as any).mockResolvedValue([]);
    const req = mockReq({ params: { userId: "1" } });
    const res = mockRes();
    await getUserRoles(req as any, res as any);
    expect(rbacService.getUserRoles).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("setUserRoles - 应设置用户角色", async () => {
    (rbacService.setUserRoles as any).mockResolvedValue([]);
    const req = mockReq({ params: { userId: "1" }, body: { roleIds: [1, 2] } });
    const res = mockRes();
    await setUserRoles(req as any, res as any);
    expect(rbacService.setUserRoles).toHaveBeenCalledWith(1, [1, 2], "t1");
    expect(ok).toHaveBeenCalled();
  });
});
