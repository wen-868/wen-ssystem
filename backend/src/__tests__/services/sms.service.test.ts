import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

// MS-SECURITY-BASELINE-01：监听 crypto.randomInt，验证码必须走密码学安全随机源
vi.mock("crypto", async (importOriginal) => {
  const mod = await importOriginal<typeof import("crypto")>();
  return { ...mod, randomInt: vi.fn(mod.randomInt) };
});

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));
vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  isSmsVerifyEnabled,
  getSmsConfig,
  assertSmsConfig,
  sendSmsCode,
  verifySmsCode,
  generateSmsCode,
} from "../../services/sms.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// MS-SECURITY-BASELINE-01：验证码必须来自密码学安全随机源（原先 Math.random 可预测）
describe("sms.service - 验证码随机性（MS-SECURITY-BASELINE-01）", () => {
  it("generateSmsCode 必须调用 crypto.randomInt（密码学安全随机源）", async () => {
    const cryptoMod = await import("crypto");
    const randomIntMock = vi.mocked(cryptoMod.randomInt);
    randomIntMock.mockClear();
    generateSmsCode();
    expect(randomIntMock).toHaveBeenCalledWith(100000, 1000000);
  });

  it("generateSmsCode 恒为 6 位数字", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateSmsCode()).toMatch(/^\d{6}$/);
    }
  });

  it("generateSmsCode 大样本下不重复且覆盖高位与低位（非固定值/非可预测序列）", () => {
    const samples = new Set<string>();
    let sawLow = false;
    let sawHigh = false;
    for (let i = 0; i < 2000; i++) {
      const c = generateSmsCode();
      samples.add(c);
      const n = Number(c);
      if (n < 500000) sawLow = true;
      if (n >= 500000) sawHigh = true;
    }
    // 2000 个样本几乎必然无碰撞（生日界 ~374 次即 50% 碰撞，安全随机源下此处仍允许极小概率）
    expect(samples.size).toBeGreaterThan(1900);
    expect(sawLow).toBe(true);
    expect(sawHigh).toBe(true);
  });
});

describe("sms.service - 短信验证开关与配置", () => {
  it("isSmsVerifyEnabled 开关开启返回 true", async () => {
    mocks.queryOne.mockResolvedValue({ configValue: "1" });
    expect(await isSmsVerifyEnabled("t1")).toBe(true);
  });

  it("isSmsVerifyEnabled 开关关闭返回 false", async () => {
    mocks.queryOne.mockResolvedValue({ configValue: "0" });
    expect(await isSmsVerifyEnabled("t1")).toBe(false);
  });

  it("getSmsConfig 聚合 5 项配置", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ configValue: "aliyun" })
      .mockResolvedValueOnce({ configValue: "ak" })
      .mockResolvedValueOnce({ configValue: "sk" })
      .mockResolvedValueOnce({ configValue: "签名" })
      .mockResolvedValueOnce({ configValue: "" });
    const cfg = await getSmsConfig("t1");
    expect(cfg).toEqual({ provider: "aliyun", accessKey: "ak", secretKey: "sk", signName: "签名", sdkAppId: "" });
  });

  it("assertSmsConfig 各缺失场景抛明确错误", () => {
    expect(() => assertSmsConfig({ provider: "", accessKey: "a", secretKey: "s", signName: "n", sdkAppId: "" }))
      .toThrow(/短信服务未配置/);
    expect(() => assertSmsConfig({ provider: "aliyun", accessKey: "", secretKey: "s", signName: "n", sdkAppId: "" }))
      .toThrow(/AccessKey 未配置/);
    expect(() => assertSmsConfig({ provider: "aliyun", accessKey: "a", secretKey: "", signName: "n", sdkAppId: "" }))
      .toThrow(/AccessKey 未配置/);
    expect(() => assertSmsConfig({ provider: "aliyun", accessKey: "a", secretKey: "s", signName: "", sdkAppId: "" }))
      .toThrow(/短信签名未配置/);
    expect(() => assertSmsConfig({ provider: "tencent", accessKey: "a", secretKey: "s", signName: "n", sdkAppId: "" }))
      .toThrow(/SdkAppId/);
    expect(() => assertSmsConfig({ provider: "aliyun", accessKey: "a", secretKey: "s", signName: "n", sdkAppId: "" }))
      .not.toThrow();
  });
});

describe("sms.service - 验证码发送与校验", () => {
  it("sendSmsCode 手机号格式错误抛 400", async () => {
    await expect(sendSmsCode("123", "REGISTER", "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "手机号格式不正确" });
  });

  it("sendSmsCode 60 秒内重复发送抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ createdAt: new Date().toISOString() });
    await expect(sendSmsCode("13800000000", "REGISTER", "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码发送过于频繁，请稍后再试" });
  });

  it("verifySmsCode 验证码错误抛 400", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(verifySmsCode("13800000000", "123456", "REGISTER", "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码错误" });
  });

  it("verifySmsCode 已使用抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, used: 1, expiresAt: new Date(Date.now() + 60000).toISOString() });
    await expect(verifySmsCode("13800000000", "123456", "REGISTER", "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码已使用" });
  });

  it("verifySmsCode 已过期抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, used: 0, expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(verifySmsCode("13800000000", "123456", "REGISTER", "t1"))
      .rejects.toMatchObject({ statusCode: 400, message: "验证码已过期，请重新获取" });
  });

  it("verifySmsCode 校验通过标记已使用", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, used: 0, expiresAt: new Date(Date.now() + 60000).toISOString() });
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await verifySmsCode("13800000000", "123456", "REGISTER", "t1");
    expect(mocks.query).toHaveBeenCalledWith("UPDATE t_member_sms_code SET used = 1 WHERE id = ?", [1]);
  });
});
