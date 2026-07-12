import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
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

import { selfRegisterMember, sendRegisterSmsCode } from "../../../services/admin/member.service";

describe("member.service - selfRegisterMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码错误");
  });

  it("验证码已使用应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, used: 1, expires_at: new Date(Date.now() + 300000) });
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码已使用");
  });

  it("验证码已过期应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, used: 0, expires_at: new Date(Date.now() - 300000) });
    await expect(selfRegisterMember(validParams)).rejects.toThrow("验证码已过期");
  });

  it("会员注册成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, used: 0, expires_at: new Date(Date.now() + 300000) });
    mocks.queryWithTenant.mockResolvedValue({ insertId: 123 });

    const result = await selfRegisterMember(validParams);

    expect(result).toEqual({ id: 123, name: "张三", mobile: "13800000000" });
    expect(mocks.hashPassword).toHaveBeenCalledWith("Pass@1234");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(5);
  });
});

describe("member.service - sendRegisterSmsCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
  });

  it("手机号格式不正确应拒绝", async () => {
    await expect(sendRegisterSmsCode("123456", "default")).rejects.toThrow("手机号格式不正确");
  });

  it("手机号已注册应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(sendRegisterSmsCode("13800000000", "default")).rejects.toThrow("该手机号已注册");
  });

  it("验证码发送过于频繁应拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ created_at: new Date() });
    await expect(sendRegisterSmsCode("13800000000", "default")).rejects.toThrow("验证码发送过于频繁");
  });

  it("验证码发送成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);

    const result = await sendRegisterSmsCode("13800000000", "default");

    expect(result.success).toBe(true);
    expect(result.message).toContain("验证码已发送");
    expect(mocks.queryWithTenant).toHaveBeenCalled();
  });
});