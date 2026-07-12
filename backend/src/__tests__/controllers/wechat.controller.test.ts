import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/wechat.service", () => ({
  login: vi.fn(),
  getSessionKey: vi.fn(),
  decryptPhone: vi.fn(),
  updateProfile: vi.fn(),
  getProfile: vi.fn(),
  bindUser: vi.fn(),
  unbindUser: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn().mockReturnValue({ wxUserId: 1, openid: "test-openid" }),
  },
  verify: vi.fn().mockReturnValue({ wxUserId: 1, openid: "test-openid" }),
}));

vi.mock("@shared/env", () => ({
  env: { JWT_SECRET: "test-secret" },
}));

import * as wechatService from "@services/wechat.service";
import { ok, fail } from "@shared/response";
import { createWechatController } from "@controllers/wechat.controller";

const mockCode2Session = vi.fn().mockResolvedValue({ openid: "test-openid", session_key: "test-session-key" });
const mockAesDecrypt = vi.fn().mockReturnValue(JSON.stringify({ phoneNumber: "13800138000" }));
const mockSignWxToken = vi.fn().mockReturnValue("test-token");

const { login, decryptPhone, updateProfile, getProfile, bind, unbind } = createWechatController(
  mockCode2Session as any,
  mockAesDecrypt as any,
  mockSignWxToken as any
);

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
  wxUser: { id: 1 },
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
  beforeEach(() => vi.clearAllMocks());

  it("login - 应微信登录", async () => {
    (wechatService.login as any).mockResolvedValue({ token: "test-token" });
    const req = mockReq({ body: { code: "test-code" } });
    const res = mockRes();
    await login(req as any, res as any);
    expect(mockCode2Session).toHaveBeenCalledWith("test-code");
    expect(wechatService.login).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("login - zod验证失败", async () => {
    const req = mockReq({ body: { code: "" } });
    const res = mockRes();
    await expect(login(req as any, res as any)).rejects.toThrow();
  });

  it("decryptPhone - 应解密手机号", async () => {
    (wechatService.getSessionKey as any).mockResolvedValue({ session_key: "test-session-key" });
    (wechatService.decryptPhone as any).mockResolvedValue({ success: true });
    const req = mockReq({
      body: { encryptedData: "test-data", iv: "test-iv" },
      headers: { authorization: "Bearer test-token" },
    });
    const res = mockRes();
    await decryptPhone(req as any, res as any);
    expect(mockAesDecrypt).toHaveBeenCalled();
    expect(wechatService.decryptPhone).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("decryptPhone - 未登录应返回401", async () => {
    const req = mockReq({ body: { encryptedData: "test-data", iv: "test-iv" }, headers: {} });
    const res = mockRes();
    await decryptPhone(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fail).toHaveBeenCalled();
  });

  it("updateProfile - 应更新用户资料", async () => {
    (wechatService.updateProfile as any).mockResolvedValue(undefined);
    const req = mockReq({ body: { nickname: "新昵称" } });
    const res = mockRes();
    await updateProfile(req as any, res as any);
    expect(wechatService.updateProfile).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateProfile - 未登录应返回401", async () => {
    const req = mockReq({ wxUser: undefined });
    const res = mockRes();
    await updateProfile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fail).toHaveBeenCalled();
  });

  it("getProfile - 应获取用户资料", async () => {
    (wechatService.getProfile as any).mockResolvedValue({ id: 1, nickname: "测试" });
    const req = mockReq();
    const res = mockRes();
    await getProfile(req as any, res as any);
    expect(wechatService.getProfile).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getProfile - 用户不存在应返回404", async () => {
    (wechatService.getProfile as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await getProfile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalled();
  });

  it("bind - 应绑定用户", async () => {
    (wechatService.bindUser as any).mockResolvedValue({ success: true, data: { id: 1 } });
    const req = mockReq({ body: { username: "admin", password: "123456", bindingType: "ADMIN" } });
    const res = mockRes();
    await bind(req as any, res as any);
    expect(wechatService.bindUser).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("bind - 绑定失败应返回错误", async () => {
    (wechatService.bindUser as any).mockResolvedValue({ success: false, message: "绑定失败", code: "400" });
    const req = mockReq({ body: { username: "admin", password: "123456", bindingType: "ADMIN" } });
    const res = mockRes();
    await bind(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("unbind - 应解绑用户", async () => {
    (wechatService.unbindUser as any).mockResolvedValue({ success: true, message: "解绑成功" });
    const req = mockReq({ body: { systemUserId: 1 } });
    const res = mockRes();
    await unbind(req as any, res as any);
    expect(wechatService.unbindUser).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("unbind - 解绑失败应返回错误", async () => {
    (wechatService.unbindUser as any).mockResolvedValue({ success: false, message: "解绑失败", code: "400" });
    const req = mockReq({ body: { systemUserId: 1 } });
    const res = mockRes();
    await unbind(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });
});
