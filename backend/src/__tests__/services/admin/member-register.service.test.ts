/**
 * 会员自助注册 service 单元测试
 * 被测文件：src/services/admin/member.service.ts
 * 短信通道以 sms.service 为边界 mock（真实发送在集成环境验证）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  queryWithTenant: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
  isSmsVerifyEnabled: vi.fn(),
  verifySmsCode: vi.fn(),
  sendSmsCode: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/password", () => ({
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/sms.service", () => ({
  isSmsVerifyEnabled: mocks.isSmsVerifyEnabled,
  verifySmsCode: mocks.verifySmsCode,
  sendSmsCode: mocks.sendSmsCode,
}));

import { selfRegisterMember, sendRegisterSmsCode } from "../../../services/admin/member.service";

describe("member.service - selfRegisterMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 短信验证开关默认开启，验证码校验默认为通过（各用例按需覆盖）
    mocks.isSmsVerifyEnabled.mockResolvedValue(true);
    mocks.verifySmsCode.mockResolvedValue();
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue("hashed_password");
    mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
  });

  const validParams = {
    mobile: "13800000000",
    password: "Pass@1234",
    smsCode: "123456",
    name: "张三",
    tenantId: "default",
  };

  it("密码强度不足应拒绝", async () => {
    mocks.validatePassword.mockReturnValue({ valid: false, errors: ["密码长度不足"] });
    await expect(selfRegisterMember(validParams)).rejects.toThrow("密码不符合要求");
  });

  it("手机号已注册应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(selfRegisterMember(validParams)).rejects.toThrow("该手机号已注册");
  });

  it("验证码错误应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.verifySmsCode.mockRejectedValue(Object.assign(new Error("验证码错误"), { statusCode: 400 }));
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码错误");
  });

  it("验证码已使用应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.verifySmsCode.mockRejectedValue(Object.assign(new Error("验证码已使用"), { statusCode: 400 }));
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码已使用");
  });

  it("验证码已过期应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.verifySmsCode.mockRejectedValue(Object.assign(new Error("验证码已过期，请重新获取"), { statusCode: 400 }));
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码已过期");
  });

  it("短信验证关闭时无需验证码直接注册", async () => {
    mocks.isSmsVerifyEnabled.mockResolvedValue(false);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 123 });
    const result = await selfRegisterMember({ ...validParams, smsCode: "" });
    expect(result.id).toBe(123);
    expect(mocks.verifySmsCode).not.toHaveBeenCalled();
  });

  it("会员注册成功（初始化积分/等级/画像）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 123 });

    const result = await selfRegisterMember(validParams);

    expect(result).toEqual({ id: 123, name: "张三", mobile: "13800000000" });
    expect(mocks.hashPassword).toHaveBeenCalledWith("Pass@1234");
    // 会员 + 积分 + 等级 + 画像 共 4 次写入
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(4);
  });
});

describe("member.service - sendRegisterSmsCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSmsVerifyEnabled.mockResolvedValue(true);
    mocks.sendSmsCode.mockResolvedValue({ success: true, message: "验证码已发送，请查收短信" });
  });

  it("手机号格式不正确应拒绝", async () => {
    await expect(sendRegisterSmsCode("123456", "default")).rejects.toThrow("手机号格式不正确");
  });

  it("手机号已注册应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(sendRegisterSmsCode("13800000000", "default")).rejects.toThrow("该手机号已注册");
  });

  it("短信验证关闭时无需发送", async () => {
    mocks.isSmsVerifyEnabled.mockResolvedValue(false);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const result = await sendRegisterSmsCode("13800000000", "default");
    expect(result.message).toContain("无需验证码");
    expect(mocks.sendSmsCode).not.toHaveBeenCalled();
  });

  it("验证码发送过于频繁应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.sendSmsCode.mockRejectedValue(Object.assign(new Error("验证码发送过于频繁，请稍后再试"), { statusCode: 400 }));
    await expect(sendRegisterSmsCode("13800000000", "default")).rejects.toThrow("验证码发送过于频繁");
  });

  it("验证码发送成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const result = await sendRegisterSmsCode("13800000000", "default");
    expect(result.success).toBe(true);
    expect(result.message).toContain("验证码已发送");
    expect(mocks.sendSmsCode).toHaveBeenCalledWith("13800000000", "REGISTER", "default");
  });
});
