/**
 * 会员 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/member.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/password", () => ({
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: mocks.loggerInfo, error: vi.fn(), warn: vi.fn() },
}));

import {
  selfRegisterMember,
  sendRegisterSmsCode,
  registerMember,
  getMemberCard,
  updateMemberLevel,
  getMemberBenefits,
} from "../../../services/admin/member.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
  mocks.hashPassword.mockResolvedValue("hashed");
});

describe("member.service - selfRegisterMember", () => {
  it("密码不符合要求时抛 AppError 400", async () => {
    mocks.validatePassword.mockReturnValue({ valid: false, errors: ["至少8位"] });
    await expect(selfRegisterMember({ mobile: "13800000000", password: "123", smsCode: "1234", tenantId: "t1" }))
      .rejects.toMatchObject({ statusCode: 400, message: "密码不符合要求：至少8位" });
  });

  it("手机号已注册时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(selfRegisterMember({ mobile: "13800000000", password: "12345678", smsCode: "1234", tenantId: "t1" }))
      .rejects.toMatchObject({ statusCode: 400, message: "该手机号已注册" });
  });

  it("验证码不存在时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(selfRegisterMember({ mobile: "13800000000", password: "12345678", smsCode: "1234", tenantId: "t1" }))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码错误" });
  });

  it("验证码已使用时抛 400", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, used: 1, expires_at: new Date(Date.now() + 60000) });
    await expect(selfRegisterMember({ mobile: "13800000000", password: "12345678", smsCode: "1234", tenantId: "t1" }))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码已使用" });
  });

  it("验证码已过期时抛 400", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, used: 0, expires_at: new Date(Date.now() - 1000) });
    await expect(selfRegisterMember({ mobile: "13800000000", password: "12345678", smsCode: "1234", tenantId: "t1" }))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码已过期" });
  });

  it("注册成功时初始化积分/等级/画像并返回", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, used: 0, expires_at: new Date(Date.now() + 60000) });
    mocks.queryWithTenant.mockResolvedValue({ insertId: 9 });
    const res = await selfRegisterMember({ mobile: "13800000000", password: "12345678", smsCode: "1234", name: "张三", tenantId: "t1" });
    expect(res).toEqual({ id: 9, name: "张三", mobile: "13800000000" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(5);
    expect(mocks.loggerInfo).toHaveBeenCalled();
  });
});

describe("member.service - sendRegisterSmsCode", () => {
  it("手机号格式不正确时抛 400", async () => {
    await expect(sendRegisterSmsCode("123", "t1")).rejects.toMatchObject({ statusCode: 400, message: "手机号格式不正确" });
  });

  it("手机号已注册时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(sendRegisterSmsCode("13800000000", "t1")).rejects.toMatchObject({ statusCode: 400, message: "该手机号已注册" });
  });

  it("60 秒内重复发送时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ created_at: new Date(Date.now() - 10000) });
    await expect(sendRegisterSmsCode("13800000000", "t1")).rejects.toMatchObject({ statusCode: 400, message: "验证码发送过于频繁，请稍后再试" });
  });

  it("发送成功返回验证码", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 1 }]);
    const res = await sendRegisterSmsCode("13800000000", "t1");
    expect(res.success).toBe(true);
    expect(res.message).toContain("验证码已发送");
    expect(mocks.loggerInfo).toHaveBeenCalled();
  });
});

describe("member.service - registerMember", () => {
  it("手机号已注册时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    await expect(registerMember({ name: "李四", mobile: "13800000000", tenantId: "t1" })).rejects.toThrow("该手机号已注册");
  });

  it("成功注册并初始化账户", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
    const res = await registerMember({ name: "李四", mobile: "13800000001", password: "pwd", referrerId: 3, tenantId: "t1" });
    expect(res).toEqual({ id: 10, name: "李四", mobile: "13800000001" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(4);
  });
});

describe("member.service - getMemberCard", () => {
  it("会员不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getMemberCard(1, "t1")).rejects.toThrow("会员不存在");
  });

  it("返回会员卡信息，缺失数据兜底", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "138", memberLevel: "VIP2", createdAt: "2026-01-01" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getMemberCard(1, "t1");
    expect(res).toMatchObject({
      id: 1,
      totalPoints: 0,
      availablePoints: 0,
      currentLevel: "VIP1",
      storeValueCard: null,
      discountRate: 1,
      benefits: null,
    });
  });
});

describe("member.service - updateMemberLevel / getMemberBenefits", () => {
  it("会员不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateMemberLevel(1, "VIP2", "t1")).rejects.toThrow("会员不存在");
  });

  it("成功调整等级并同步三张表", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateMemberLevel(1, "VIP2", "t1");
    expect(res).toEqual({ memberId: 1, levelName: "VIP2" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(3);
  });

  it("getMemberBenefits 返回权益列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ levelName: "VIP1" }]);
    const res = await getMemberBenefits("t1");
    expect(res).toEqual([{ levelName: "VIP1" }]);
  });
});
