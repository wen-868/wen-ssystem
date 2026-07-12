import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env 模块
vi.mock("../../config/env", () => ({
  env: {
    WECHAT_APP_ID: "test_app_id",
    WECHAT_MCH_ID: "test_mch_id",
    WECHAT_PAY_SERIAL_NO: "test_serial",
    WECHAT_PAY_PRIVATE_KEY_PATH: "",
    WECHAT_PAY_PLATFORM_CERT_PATH: "",
    WECHAT_PAY_API_V3_KEY: "test_api_v3_key",
    WECHAT_PAY_NOTIFY_URL: "https://example.com/notify",
  }
}));

// Mock fs
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  const mockedFs = {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
  };
  return {
    ...mockedFs,
    default: mockedFs,
  };
});

import { WechatPay } from "../../config/wechat-pay";
import fs from "fs";

describe("config/wechat-pay", () => {
  let pay: WechatPay;

  beforeEach(() => {
    vi.clearAllMocks();
    pay = new WechatPay();
  });

  it("应正确初始化配置", () => {
    expect(pay).toBeDefined();
  });

  it("当私钥路径为空时应返回空字符串", () => {
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it("验证通知签名 - 缺少必要头应返回false", () => {
    const result = (pay as any).verifyNotifySignature({}, "");
    expect(result).toBe(false);
  });

  it("验证通知签名 - 缺少部分头应返回false", () => {
    const result = (pay as any).verifyNotifySignature({
      "wechatpay-serial": "123",
    }, "");
    expect(result).toBe(false);
  });

  it("验证通知签名 - 无平台证书时应返回false", () => {
    const result = (pay as any).verifyNotifySignature({
      "wechatpay-serial": "123",
      "wechatpay-signature": "sig",
      "wechatpay-timestamp": "ts",
      "wechatpay-nonce": "nonce",
    }, "body");
    expect(result).toBe(false);
  });

  it("解密通知数据 - 无效数据应抛出错误", () => {
    expect(() => {
      (pay as any).decryptNotifyData("data", "nonce", "invalidciphertext");
    }).toThrow("解密失败");
  });

  it("生成nonceStr应返回无横线的UUID", () => {
    const nonce = (pay as any).generateNonceStr();
    expect(nonce).not.toContain("-");
    expect(nonce.length).toBe(32);
  });

  it("生成timestamp应返回数字字符串", () => {
    const ts = (pay as any).generateTimestamp();
    expect(typeof ts).toBe("string");
    expect(Number(ts)).toBeGreaterThan(0);
  });

  it("签名 - 无私钥时应抛出错误", () => {
    expect(() => {
      (pay as any).sign("test data");
    }).toThrow("私钥未配置");
  });

  it("构建授权头 - 无私钥时应抛出错误", () => {
    expect(() => {
      (pay as any).buildAuthorization("GET", "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi");
    }).toThrow("私钥未配置");
  });
});
