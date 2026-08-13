/**
 * 收银硬件服务单元测试
 * 被测：hardware-config / cloud-speaker / payment-box / unionpay
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
  queryWithTenant: vi.fn(),
  offlinePayment: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../services/store/sale-bill.service", () => ({
  offlinePayment: mocks.offlinePayment,
  paymentOnSaleBill: vi.fn(),
}));

import { HardwareConfigService } from "../../../services/hardware/hardware-config.service";
import * as cloudSpeaker from "../../../services/hardware/cloud-speaker.service";
import * as paymentBox from "../../../services/hardware/payment-box.service";
import * as unionpay from "../../../services/hardware/unionpay.service";

beforeEach(() => {
  mocks.queryOneWithTenant.mockReset();
  mocks.executeWithTenant.mockReset();
  mocks.queryWithTenant.mockReset();
  mocks.offlinePayment.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hardware-config.service", () => {
  it("无配置时返回默认空配置", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await HardwareConfigService.getConfig("t1", "cloud_speaker");
    expect(res.enabled).toBe(false);
    expect(res.config).toEqual({});
  });

  it("有配置时脱敏返回（apiKey 打码）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      category: "unionpay",
      enabled: 1,
      config_json: '{"mchId":"MCH1","apiKey":"SECRET123456"}',
    });
    const res = await HardwareConfigService.getConfig("t1", "unionpay");
    expect(res.enabled).toBe(true);
    expect(res.config.mchId).toBe("MCH1");
    expect(res.config.apiKey).not.toContain("SECRET123456");
  });

  it("保存配置：存在则 UPDATE，不存在则 INSERT", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    mocks.executeWithTenant.mockResolvedValue({});
    await HardwareConfigService.saveConfig("t1", "scale", { port: "COM3" }, true);
    expect(mocks.executeWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_hardware_config"),
      expect.any(Array),
      "t1"
    );

    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await HardwareConfigService.saveConfig("t1", "scale", { port: "COM3" }, true);
    expect(mocks.executeWithTenant).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO t_hardware_config"),
      expect.any(Array),
      "t1"
    );
  });

  it("getRawConfig 返回未脱敏配置", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      config_json: '{"apiKey":"RAW_SECRET"}',
    });
    const res = await HardwareConfigService.getRawConfig("t1", "unionpay");
    expect(res.config.apiKey).toBe("RAW_SECRET");
  });

  it("保存时掩码值（****）保留库中原密钥，不覆盖真实值", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1,
      config_json: '{"gatewayUrl":"https://up.example.com","apiKey":"REAL_SECRET"}',
    });
    mocks.executeWithTenant.mockResolvedValue({});
    await HardwareConfigService.saveConfig("t1", "unionpay", {
      gatewayUrl: "https://up.example.com",
      apiKey: "REAL****CRET",
    }, true);
    const [, params] = mocks.executeWithTenant.mock.calls[0];
    const stored = JSON.parse(params[0] as string);
    expect(stored.apiKey).toBe("REAL_SECRET");
  });
});

describe("cloud-speaker.service", () => {
  it("未配置时返回失败原因", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await cloudSpeaker.announce({ tenantId: "t1", amount: 98, orderNo: "XS1", channel: "SALE" });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("未配置");
  });

  it("配置后调用服务商接口并返回结果", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      config_json: '{"apiUrl":"https://speaker.example.com/pay","deviceId":"DEV1","secret":"S"}',
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "OK" }));
    const res = await cloudSpeaker.announce({ tenantId: "t1", amount: 98, orderNo: "XS1", channel: "SALE" });
    expect(res.success).toBe(true);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://speaker.example.com/pay",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("payment-box.service", () => {
  it("未配置时返回失败", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 0, box_config: null });
    const res = await paymentBox.createBoxPayment({ tenantId: "t1", amount: 98, orderNo: "XS1", subject: "收款" });
    expect(res.success).toBe(false);
  });

  it("串口联动模式返回命令模板", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"provider":"银盛","comPort":"COM3","commandTemplate":"7B616D6F756E747D","enabled":true}',
    });
    const res = await paymentBox.createBoxPayment({ tenantId: "t1", amount: 98, orderNo: "XS1", subject: "收款" });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("SERIAL");
    expect((res.detail as Record<string, unknown>).comPort).toBe("COM3");
  });

  it("HTTP 通道调用服务商接口", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"provider":"银盛","apiUrl":"https://box.example.com/pay","activationCode":"ACT1","secret":"S","enabled":true}',
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "OK" }));
    const res = await paymentBox.createBoxPayment({ tenantId: "t1", amount: 98, orderNo: "XS1", subject: "收款" });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("HTTP");
  });

  it("回调成功时落销售单收款", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"secret":"SECRET1","enabled":true}',
    });
    const crypto = await import("crypto");
    const sign = crypto.createHash("md5").update("XS1|98|SECRET1").digest("hex");
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS1", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await paymentBox.handleBoxCallback({
      tenantId: "t1",
      body: { outTradeNo: "XS1", amount: 98, status: "SUCCESS", transactionId: "BOX001", sign },
    });
    expect(res.success).toBe(true);
    expect(mocks.offlinePayment).toHaveBeenCalledWith(expect.objectContaining({ billNo: "XS1", paymentMethod: "BOX" }));
  });

  it("回调非成功状态不落单", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"secret":"SECRET1","enabled":true}',
    });
    const crypto = await import("crypto");
    const sign = crypto.createHash("md5").update("XS1|98|SECRET1").digest("hex");
    const res = await paymentBox.handleBoxCallback({
      tenantId: "t1",
      body: { outTradeNo: "XS1", amount: 98, status: "FAIL", sign },
    });
    expect(res.success).toBe(false);
    expect(mocks.offlinePayment).not.toHaveBeenCalled();
  });

  it("回调未配置签名密钥时拒绝（防伪造支付成功）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, box_config: '{"provider":"银盛","enabled":true}' });
    const res = await paymentBox.handleBoxCallback({
      tenantId: "t1",
      body: { outTradeNo: "XS1", amount: 98, status: "SUCCESS" },
    });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("签名密钥");
    expect(mocks.offlinePayment).not.toHaveBeenCalled();
  });

  it("回调配置 secret 时校验签名，错误签名拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"secret":"SECRET1","enabled":true}',
    });
    const res = await paymentBox.handleBoxCallback({
      tenantId: "t1",
      body: { outTradeNo: "XS1", amount: 98, status: "SUCCESS", sign: "WRONG" },
    });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("签名");
    expect(mocks.offlinePayment).not.toHaveBeenCalled();
  });

  it("回调正确签名时落单", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"secret":"SECRET1","enabled":true}',
    });
    const crypto = await import("crypto");
    const sign = crypto.createHash("md5").update("XS1|98|SECRET1").digest("hex");
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS1", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await paymentBox.handleBoxCallback({
      tenantId: "t1",
      body: { outTradeNo: "XS1", amount: 98, status: "SUCCESS", sign },
    });
    expect(res.success).toBe(true);
    expect(mocks.offlinePayment).toHaveBeenCalled();
  });

  it("保存盒子配置：掩码激活码与空密钥保留原值", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 }) // provider 行存在
      .mockResolvedValueOnce({ box_config: '{"provider":"银盛","activationCode":"ACT123456","secret":"SECRET1"}' });
    mocks.executeWithTenant.mockResolvedValue({});
    await paymentBox.saveBoxConfig("t1", {
      provider: "银盛",
      activationCode: "ACT1****3456",
      secret: "",
    }, true);
    const [, params] = mocks.executeWithTenant.mock.calls[0];
    const stored = JSON.parse(params[0] as string);
    expect(stored.activationCode).toBe("ACT123456");
    expect(stored.secret).toBe("SECRET1");
  });
});

describe("unionpay.service", () => {
  it("未配置时返回 CHANNEL_NOT_CONFIGURED", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await unionpay.payByAuthCode({ tenantId: "t1", outTradeNo: "XS1", amount: 98, authCode: "6212345678901234567" });
    expect(res.success).toBe(false);
    expect(res.errCode).toBe("CHANNEL_NOT_CONFIGURED");
  });

  it("配置后调用网关并解析成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      config_json: '{"gatewayUrl":"https://up.example.com/gateway","mchId":"MCH1","apiKey":"KEY1"}',
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, transactionId: "UP001" }),
    }));
    const res = await unionpay.payByAuthCode({ tenantId: "t1", outTradeNo: "XS1", amount: 98, authCode: "6212345678901234567" });
    expect(res.success).toBe(true);
    expect(res.transactionId).toBe("UP001");
  });

  it("网关返回失败时透传错误", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      config_json: '{"gatewayUrl":"https://up.example.com/gateway","mchId":"MCH1","apiKey":"KEY1"}',
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ code: "ERR", msg: "网关繁忙" }),
    }));
    const res = await unionpay.payByAuthCode({ tenantId: "t1", outTradeNo: "XS1", amount: 98, authCode: "6212345678901234567" });
    expect(res.success).toBe(false);
    expect(res.errMsg).toContain("网关繁忙");
  });
});
