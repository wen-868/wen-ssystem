import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryOneWithTenant: mocks.queryOne,
}));

vi.stubGlobal("fetch", mocks.fetch);

import { createJsapiPayment, getWechatPayConfig } from "../../services/wechat-pay.service";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const mockConfig = {
  app_id: "wx123",
  mch_id: "1600000000",
  api_v3_key: "v3key",
  private_key: privateKey,
  serial_no: "SER001",
  notify_url: "https://api.onepan.cn/api/miniapp/pay/notify",
  enabled: 1,
};

describe("wechat-pay.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getWechatPayConfig：配置未启用时抛错", async () => {
    mocks.queryOne.mockResolvedValueOnce({ ...mockConfig, enabled: 0 });
    await expect(getWechatPayConfig("t1")).rejects.toThrow("微信支付未启用");
  });

  it("getWechatPayConfig：配置不完整时抛错", async () => {
    mocks.queryOne.mockResolvedValueOnce({ ...mockConfig, serial_no: "" });
    await expect(getWechatPayConfig("t1")).rejects.toThrow("配置不完整");
  });

  it("createJsapiPayment：下单成功返回 JSAPI 参数", async () => {
    mocks.queryOne.mockResolvedValueOnce(mockConfig);
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ prepay_id: "wxprepay123" }),
    });

    const result = await createJsapiPayment({
      tenantId: "t1",
      openid: "openid_abc",
      orderNo: "DD20260815001",
      amountYuan: 128.5,
      description: "智享酒水订单DD20260815001",
    });

    expect(result.prepayId).toBe("wxprepay123");
    expect(result.package).toBe("prepay_id=wxprepay123");
    expect(result.signType).toBe("RSA");
    expect(result.paySign).toBeTruthy();
    expect(result.timeStamp).toBeTruthy();
    // 请求体校验：金额分、openid、out_trade_no
    const [, init] = mocks.fetch.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.amount.total).toBe(12850);
    expect(body.payer.openid).toBe("openid_abc");
    expect(body.out_trade_no).toBe("DD20260815001");
    expect(String(init.headers.Authorization)).toContain("WECHATPAY2-SHA256-RSA2048");
    expect(String(init.headers.Authorization)).toContain("serial_no=\"SER001\"");
  });

  it("createJsapiPayment：微信返回错误时抛出", async () => {
    mocks.queryOne.mockResolvedValueOnce(mockConfig);
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ code: "PARAM_ERROR", message: "参数错误" }),
    });
    await expect(createJsapiPayment({
      tenantId: "t1",
      openid: "openid_abc",
      orderNo: "DD001",
      amountYuan: 1,
      description: "测试",
    })).rejects.toThrow("微信支付下单失败");
  });
});
