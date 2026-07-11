import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/wechat.service.js", () => ({
  login: vi.fn(),
  getSessionKey: vi.fn(),
  decryptPhone: vi.fn(),
  updateProfile: vi.fn(),
  getProfile: vi.fn(),
  bindUser: vi.fn(),
  unbindUser: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../shared/env.js", () => ({
  env: { JWT_SECRET: "test-secret" },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(() => ({ wxUserId: 1, openid: "openid123" })),
  },
}));

import * as wechatService from "../../services/wechat.service.js";
import { ok, fail } from "../../shared/response.js";
import { createWechatController } from "../../controllers/wechat.controller.js";

const mockCode2Session = vi.fn();
const mockAesDecrypt = vi.fn();
const mockSignWxToken = vi.fn();

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  wxUser: { id: 1, openid: "openid123" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("wechat.controller", () => {
  let controller: ReturnType<typeof createWechatController>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = createWechatController(mockCode2Session, mockAesDecrypt, mockSignWxToken);
  });

  it("login - 应登录成功", async () => {
    mockCode2Session.mockResolvedValue({ openid: "openid123", session_key: "session123" });
    (wechatService.login as any).mockResolvedValue({ token: "token123" });
    const req = mockReq({ body: { code: "code123" } });
    const res = mockRes();
    await controller.login(req as any, res as any);
    expect(mockCode2Session).toHaveBeenCalledWith("code123");
    expect(wechatService.login).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("decryptPhone - 未登录应返回401", async () => {
    const req = mockReq({ headers: {}, body: { encryptedData: "enc", iv: "iv123" } });
    const res = mockRes();
    await controller.decryptPhone(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("未登录", "401");
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("decryptPhone - session_key不存在应返回400", async () => {
    (wechatService.getSessionKey as any).mockResolvedValue(null);
    const req = mockReq({
      headers: { authorization: "Bearer token123" },
      body: { encryptedData: "enc", iv: "iv123" },
    });
    const res = mockRes();
    await controller.decryptPhone(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("session_key不存在，请重新登录", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("decryptPhone - 应解密手机号成功", async () => {
    (wechatService.getSessionKey as any).mockResolvedValue({ session_key: "session123" });
    mockAesDecrypt.mockReturnValue(JSON.stringify({ phoneNumber: "13800138000" }));
    (wechatService.decryptPhone as any).mockResolvedValue({ phone: "13800138000" });
    const req = mockReq({
      headers: { authorization: "Bearer token123" },
      body: { encryptedData: "enc", iv: "iv123" },
    });
    const res = mockRes();
    await controller.decryptPhone(req as any, res as any);
    expect(wechatService.decryptPhone).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateProfile - 未登录应返回401", async () => {
    const req = mockReq({ wxUser: undefined });
    const res = mockRes();
    await controller.updateProfile(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("未登录", "401");
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("updateProfile - 应更新用户资料", async () => {
    (wechatService.updateProfile as any).mockResolvedValue(undefined);
    const req = mockReq({ body: { nickname: "新昵称", avatarUrl: "avatar.jpg" } });
    const res = mockRes();
    await controller.updateProfile(req as any, res as any);
    expect(wechatService.updateProfile).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ message: "更新成功" });
  });

  it("getProfile - 用户不存在应返回404", async () => {
    (wechatService.getProfile as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await controller.getProfile(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("用户不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getProfile - 应返回用户资料", async () => {
    (wechatService.getProfile as any).mockResolvedValue({ id: 1, nickname: "测试用户" });
    const req = mockReq();
    const res = mockRes();
    await controller.getProfile(req as any, res as any);
    expect(wechatService.getProfile).toHaveBeenCalledWith(1);
    expect(ok).toHaveBeenCalled();
  });

  it("bind - 绑定失败应返回400", async () => {
    (wechatService.bindUser as any).mockResolvedValue({ success: false, message: "绑定失败", code: "400" });
    const req = mockReq({
      body: { username: "admin", password: "123456", bindingType: "ADMIN" },
    });
    const res = mockRes();
    await controller.bind(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("绑定失败", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("bind - 应绑定成功", async () => {
    (wechatService.bindUser as any).mockResolvedValue({ success: true, data: { userId: 1 } });
    const req = mockReq({
      body: { username: "admin", password: "123456", bindingType: "ADMIN" },
    });
    const res = mockRes();
    await controller.bind(req as any, res as any);
    expect(wechatService.bindUser).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("unbind - 解绑失败应返回400", async () => {
    (wechatService.unbindUser as any).mockResolvedValue({ success: false, message: "解绑失败", code: "400" });
    const req = mockReq({ body: { systemUserId: 1 } });
    const res = mockRes();
    await controller.unbind(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("解绑失败", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("unbind - 应解绑成功", async () => {
    (wechatService.unbindUser as any).mockResolvedValue({ success: true, message: "解绑成功" });
    const req = mockReq({ body: { systemUserId: 1 } });
    const res = mockRes();
    await controller.unbind(req as any, res as any);
    expect(wechatService.unbindUser).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ message: "解绑成功" });
  });
});
