import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/member.service", () => ({
  sendRegisterSmsCode: vi.fn().mockResolvedValue({}),
  selfRegisterMember: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { sendSmsCode, registerMember } from "@controllers/admin/member-register.controller";

const mockReq = (overrides: any = {}) => ({
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("member-register.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sendSmsCode - 应发送验证码", async () => {
    const req = mockReq({ body: { mobile: "13800138000", tenantId: 1 } });
    const res = mockRes();
    await sendSmsCode(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("sendSmsCode - 缺少必填字段应返回错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await sendSmsCode(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("registerMember - 应注册会员", async () => {
    const req = mockReq({ body: { mobile: "13800138000", password: "123456", smsCode: "1234", tenantId: 1 } });
    const res = mockRes();
    await registerMember(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("registerMember - 缺少必填字段应返回错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await registerMember(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
