import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/auth.service", () => ({
  login: vi.fn(),
  changePassword: vi.fn(),
  getMe: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as authService from "../../../services/admin/auth.service";
import { ok, fail } from "../../../shared/response";
import {
  login,
  changePassword,
  getMe,
  getSettings,
  updateSettings,
} from "../../../controllers/admin/auth.controller";

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

describe("auth.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login - 应登录成功", async () => {
    (authService.login as any).mockResolvedValue({ token: "token123", user: { id: 1 } });
    const req = mockReq({ body: { username: "admin", password: "Admin@123" } });
    const res = mockRes();
    await login(req as any, res as any);
    expect(authService.login).toHaveBeenCalledWith("admin", "Admin@123");
    expect(ok).toHaveBeenCalled();
  });

  it("changePassword - 应修改密码成功", async () => {
    (authService.changePassword as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "NewPass@123" } });
    const res = mockRes();
    await changePassword(req as any, res as any);
    expect(authService.changePassword).toHaveBeenCalledWith(1, "oldPass", "NewPass@123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("changePassword - 密码长度不足应返回400", async () => {
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "Short1@" } });
    const res = mockRes();
    await changePassword(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("changePassword - 缺少大写字母应返回400", async () => {
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "nouppercase123@" } });
    const res = mockRes();
    await changePassword(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("changePassword - 缺少小写字母应返回400", async () => {
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "NOLOWERCASE123@" } });
    const res = mockRes();
    await changePassword(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("changePassword - 缺少数字应返回400", async () => {
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "NoNumberHere@" } });
    const res = mockRes();
    await changePassword(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("getMe - 应返回当前用户信息", async () => {
    (authService.getMe as any).mockResolvedValue({ id: 1, username: "admin" });
    const req = mockReq();
    const res = mockRes();
    await getMe(req as any, res as any);
    expect(authService.getMe).toHaveBeenCalledWith({ id: 1, username: "admin" });
    expect(ok).toHaveBeenCalled();
  });

  it("getSettings - 应返回用户设置", async () => {
    (authService.getSettings as any).mockResolvedValue({ defaultHomepage: "/admin" });
    const req = mockReq();
    const res = mockRes();
    await getSettings(req as any, res as any);
    expect(authService.getSettings).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateSettings - 应更新用户设置", async () => {
    (authService.updateSettings as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { defaultHomepage: "/cashier" } });
    const res = mockRes();
    await updateSettings(req as any, res as any);
    expect(authService.updateSettings).toHaveBeenCalledWith(1, "/cashier", "t1");
    expect(ok).toHaveBeenCalled();
  });
});
