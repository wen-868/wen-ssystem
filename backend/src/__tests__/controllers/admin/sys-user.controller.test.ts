import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn((fn: any) => {
    const mockConn: any = { execute: vi.fn().mockResolvedValue([{ insertId: 1 }]) };
    return fn(mockConn);
  }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { query, queryOne } from "@shared/db";
import { ok, fail } from "@shared/response";
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
  beforeEach(() => vi.clearAllMocks());

  it("listSysUsers - 应列出用户", async () => {
    (queryOne as any).mockResolvedValue({ total: 1 });
    (query as any).mockResolvedValue([{ id: 1, username: "test" }]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createSysUser - 应创建用户", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq({ body: { username: "test", realName: "Test", password: "123456" } });
    const res = mockRes();
    await createSysUser(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getSysUser - 应获取用户", async () => {
    (queryOne as any).mockResolvedValue({ id: 1, username: "test" });
    (query as any).mockResolvedValue([]);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getSysUser(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("updateSysUser - 应更新用户", async () => {
    (queryOne as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 }, body: { realName: "New Name" } });
    const res = mockRes();
    await updateSysUser(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("resetSysUserPassword - 应重置密码", async () => {
    (queryOne as any).mockResolvedValue({ id: 1, username: "test" });
    (query as any).mockResolvedValue({ affectedRows: 1 });
    const req = mockReq({ params: { id: 1 }, body: { newPassword: "newpassword" } });
    const res = mockRes();
    await resetSysUserPassword(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("deleteSysUser - 应删除用户", async () => {
    (queryOne as any).mockResolvedValue({ id: 1, username: "test" });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteSysUser(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("listSysUsers - 传keyword和status时正确过滤", async () => {
    (queryOne as any).mockResolvedValue({ total: 1 });
    (query as any).mockResolvedValue([{ id: 1, username: "test" }]);
    const req = mockReq({ query: { keyword: "test", status: "ACTIVE" } });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("listSysUsers - queryOne返回null时total使用默认值0", async () => {
    (queryOne as any).mockResolvedValue(null);
    (query as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSysUsers(req as any, res as any);
    expect(ok).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it("createSysUser - 用户名已存在应返回400", async () => {
    (queryOne as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { username: "test", realName: "Test", password: "123456" } });
    const res = mockRes();
    await createSysUser(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("用户名已存在", "400");
  });
});
