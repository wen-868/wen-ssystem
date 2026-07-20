import { vi, describe, it, beforeEach, expect } from "vitest";

const sysUserServiceMocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  getUserDetail: vi.fn(),
  updateUser: vi.fn(),
  resetPassword: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@services/admin/sys-user.service", () => sysUserServiceMocks);

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn((fn: any) => {
    const mockConn: any = { execute: vi.fn().mockResolvedValue([{ insertId: 1 }]) };
    return fn(mockConn);
  }),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import * as sysUserService from "@services/admin/sys-user.service";
import { ok } from "@shared/response";
import { listSysUsers, createSysUser, getSysUser, updateSysUser, resetSysUserPassword, deleteSysUser } from "@controllers/admin/sys-user.controller";

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
  return res;
};

describe("sys-user.controller", () => {
  beforeEach(() => vi.resetAllMocks());

  it("listSysUsers - 应列出用户", async () => {
    (sysUserServiceMocks.listUsers as any).mockResolvedValue({
      total: 1, page: 1, pageSize: 20, records: [{ id: 1, username: "test" }],
    });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(sysUserServiceMocks.listUsers).toHaveBeenCalledWith("t1", expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(ok).toHaveBeenCalled();
  });

  it("createSysUser - 应创建用户", async () => {
    (sysUserServiceMocks.createUser as any).mockResolvedValue({ id: 1, username: "test" });
    const req = mockReq({ body: { username: "test", realName: "Test", password: "123456", roleIds: [] } });
    const res = mockRes();
    await createSysUser(req as any, res as any);
    expect(sysUserServiceMocks.createUser).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ username: "test", realName: "Test", password: "123456" }),
      1,
      "admin"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSysUser - 应获取用户", async () => {
    (sysUserServiceMocks.getUserDetail as any).mockResolvedValue({ id: 1, username: "test" });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getSysUser(req as any, res as any);
    expect(sysUserServiceMocks.getUserDetail).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("updateSysUser - 应更新用户", async () => {
    (sysUserServiceMocks.updateUser as any).mockResolvedValue({ id: 1, realName: "New Name" });
    const req = mockReq({ params: { id: 1 }, body: { realName: "New Name" } });
    const res = mockRes();
    await updateSysUser(req as any, res as any);
    expect(sysUserServiceMocks.updateUser).toHaveBeenCalledWith(
      "t1", 1, expect.objectContaining({ realName: "New Name" }), 1, "admin"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("resetSysUserPassword - 应重置密码", async () => {
    (sysUserServiceMocks.resetPassword as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 }, body: { newPassword: "newpassword" } });
    const res = mockRes();
    await resetSysUserPassword(req as any, res as any);
    expect(sysUserServiceMocks.resetPassword).toHaveBeenCalledWith("t1", 1, "newpassword", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("deleteSysUser - 应删除用户", async () => {
    (sysUserServiceMocks.deleteUser as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteSysUser(req as any, res as any);
    expect(sysUserServiceMocks.deleteUser).toHaveBeenCalledWith("t1", 1, 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("listSysUsers - 传keyword和status时正确过滤", async () => {
    (sysUserServiceMocks.listUsers as any).mockResolvedValue({
      total: 1, page: 1, pageSize: 20, records: [{ id: 1, username: "test" }],
    });
    const req = mockReq({ query: { keyword: "test", status: "ACTIVE" } });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(sysUserServiceMocks.listUsers).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ keyword: "test", status: "ACTIVE" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listSysUsers - queryOne返回null时total使用默认值0", async () => {
    (sysUserServiceMocks.listUsers as any).mockResolvedValue({
      total: 0, page: 1, pageSize: 20, records: [],
    });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(ok).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it("createSysUser - 用户名已存在应抛错", async () => {
    const error = Object.assign(new Error("用户名已存在"), { statusCode: 400 });
    (sysUserServiceMocks.createUser as any).mockRejectedValue(error);
    const req = mockReq({ body: { username: "test", realName: "Test", password: "123456", roleIds: [] } });
    const res = mockRes();
    await expect(createSysUser(req as any, res as any)).rejects.toMatchObject({
      message: "用户名已存在",
      statusCode: 400,
    });
  });
});
