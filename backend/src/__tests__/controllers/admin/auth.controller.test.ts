import { vi, describe, it, beforeEach, expect } from "vitest";

const envMocks = vi.hoisted(() => ({ isDemoLoginEnabled: vi.fn() }));

// S3-165（F1）：`config/env` 必须做「部分 mock」——整体替换会把 `env` 等其余导出变成
// undefined，导致 `shared/logger.ts` 读 `env.LOG_LEVEL` 时整个测试文件加载失败。
vi.mock("../../../config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/env")>()),
  isDemoLoginEnabled: envMocks.isDemoLoginEnabled,
}));

vi.mock("../../../services/admin/auth.service", () => ({
  login: vi.fn(),
  demoLogin: vi.fn(),
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
  // asyncHandler 透传异步函数的错误，由全局 errorHandler 处理
  asyncHandler: (fn: any) => fn,
}));

import * as authService from "../../../services/admin/auth.service";
import { ok } from "../../../shared/response";
import {
  login,
  demoLogin,
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
    await login(req as any, res as any, vi.fn());
    // S3-160：未传 rememberMe 时归一为 false（缺省仍 4h）
    expect(authService.login).toHaveBeenCalledWith("admin", "Admin@123", false);
    expect(ok).toHaveBeenCalled();
  });

  it("login - rememberMe=true 原样透传到 service（S3-160 长效）", async () => {
    (authService.login as any).mockResolvedValue({ token: "token123", user: { id: 1 } });
    const req = mockReq({ body: { username: "admin", password: "Admin@123", rememberMe: true } });
    const res = mockRes();
    await login(req as any, res as any, vi.fn());
    expect(authService.login).toHaveBeenCalledWith("admin", "Admin@123", true);
    expect(ok).toHaveBeenCalled();
  });

  // ── S3-165：演示免密登录按环境门控 ──
  it("demoLogin - 生产环境（门控关闭）应拒绝：403 + 明确文案，且不调用 service、不签发令牌", async () => {
    envMocks.isDemoLoginEnabled.mockReturnValue(false);
    const req = mockReq();
    const res = mockRes();
    await expect(demoLogin(req as any, res as any, vi.fn())).rejects.toMatchObject({
      message: "演示登录在生产环境已禁用",
      statusCode: 403,
    });
    expect(authService.demoLogin).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("demoLogin - 非生产（门控开启）仍返回令牌", async () => {
    envMocks.isDemoLoginEnabled.mockReturnValue(true);
    (authService.demoLogin as any).mockResolvedValue({ token: "demo-token", demo: true });
    const req = mockReq();
    const res = mockRes();
    await demoLogin(req as any, res as any, vi.fn());
    expect(authService.demoLogin).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith({ token: "demo-token", demo: true });
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it("changePassword - 应修改密码成功", async () => {
    (authService.changePassword as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "NewPass@123" } });
    const res = mockRes();
    await changePassword(req as any, res as any, vi.fn());
    expect(authService.changePassword).toHaveBeenCalledWith(1, "oldPass", "NewPass@123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("changePassword - 密码强度校验由 service 层统一处理，service 抛错时 controller 透传错误", async () => {
    // R54-14：controller 不再做密码强度校验，统一由 service 层 validatePassword 完成
    // service 校验失败时抛 AppError，asyncHandler 透传给全局 errorHandler
    const error = Object.assign(new Error("密码不符合要求：密码必须包含特殊字符"), { statusCode: 400 });
    (authService.changePassword as any).mockRejectedValue(error);
    const req = mockReq({ body: { oldPassword: "oldPass", newPassword: "NoSpecialChar1" } });
    const res = mockRes();
    await expect(changePassword(req as any, res as any, vi.fn())).rejects.toMatchObject({
      message: "密码不符合要求：密码必须包含特殊字符",
      statusCode: 400,
    });
    expect(authService.changePassword).toHaveBeenCalledWith(1, "oldPass", "NoSpecialChar1", "t1");
  });

  it("getMe - 应返回当前用户信息", async () => {
    (authService.getMe as any).mockResolvedValue({ id: 1, username: "admin" });
    const req = mockReq();
    const res = mockRes();
    await getMe(req as any, res as any, vi.fn());
    expect(authService.getMe).toHaveBeenCalledWith({ id: 1, username: "admin" });
    expect(ok).toHaveBeenCalled();
  });

  it("getSettings - 应返回用户设置", async () => {
    (authService.getSettings as any).mockResolvedValue({ defaultHomepage: "/admin" });
    const req = mockReq();
    const res = mockRes();
    await getSettings(req as any, res as any, vi.fn());
    expect(authService.getSettings).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateSettings - 应更新用户设置", async () => {
    (authService.updateSettings as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { defaultHomepage: "/cashier" } });
    const res = mockRes();
    await updateSettings(req as any, res as any, vi.fn());
    expect(authService.updateSettings).toHaveBeenCalledWith(1, "/cashier", "t1");
    expect(ok).toHaveBeenCalled();
  });
});
