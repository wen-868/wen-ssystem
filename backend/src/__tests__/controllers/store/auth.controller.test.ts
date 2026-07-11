import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/auth.service.js", () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  getStoreInfo: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as authService from "../../../services/store/auth.service.js";
import { ok, fail } from "../../../shared/response.js";
import { login, getMe, getStoreInfo } from "../../../controllers/store/auth.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/auth.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login - 应登录成功", async () => {
    (authService.login as any).mockResolvedValue({ token: "token123", user: { id: 1 } });
    const req = mockReq({ body: { username: "storeuser", password: "123456" } });
    const res = mockRes();
    await login(req as any, res as any);
    expect(authService.login).toHaveBeenCalledWith("storeuser", "123456");
    expect(ok).toHaveBeenCalled();
  });

  it("getMe - 应返回当前用户信息", async () => {
    (authService.getCurrentUser as any).mockReturnValue({ id: 1, username: "storeuser" });
    const req = mockReq();
    const res = mockRes();
    await getMe(req as any, res as any);
    expect(authService.getCurrentUser).toHaveBeenCalledWith(req.user);
    expect(ok).toHaveBeenCalled();
  });

  it("getStoreInfo - 门店不存在应返回404", async () => {
    (authService.getStoreInfo as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await getStoreInfo(req as any, res as any);
    expect(authService.getStoreInfo).toHaveBeenCalledWith(1, "t1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("门店不存在", "1");
  });

  it("getStoreInfo - 应返回门店信息", async () => {
    (authService.getStoreInfo as any).mockResolvedValue({ id: 1, name: "门店A" });
    const req = mockReq();
    const res = mockRes();
    await getStoreInfo(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
