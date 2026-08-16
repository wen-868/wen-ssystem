import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
  offlinePayment: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
  transaction: vi.fn(),
}));
vi.mock("../../../services/store/sale-bill.service", () => ({ offlinePayment: mocks.offlinePayment, paymentOnSaleBill: vi.fn() }));

import * as paymentBox from "../../../services/hardware/payment-box.service";

const tenantId = "t1";
function cfgBox(extra: Record<string, unknown> = {}) {
  return { box_config: JSON.stringify({ enabled: true, secret: "abc", ...extra }) };
}
beforeEach(() => vi.clearAllMocks());

describe("payment-box.service - 配置读写", () => {
  it("getBoxConfigPublic 脱敏 secret", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox({ secret: "abcdefghij", activationCode: "CODE1234" }));
    const res = await paymentBox.getBoxConfigPublic(tenantId);
    expect(res.enabled).toBe(true);
    expect(res.config.secret).toContain("****");
    expect(res.config.secret).not.toBe("abcdefghij");
    expect(res.config.activationCode).toContain("****");
  });

  it("saveBoxConfig 保留脱敏前的真实密钥", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(cfgBox({ activationCode: "REALCODE", secret: "REALSECRET" }));
    await paymentBox.saveBoxConfig(tenantId, { activationCode: "****", secret: "****" } as any, true);
    expect(mocks.executeWithTenant).toHaveBeenCalled();
    expect(String(mocks.executeWithTenant.mock.calls[0][0])).toContain("UPDATE t_payment_config");
  });

  it("saveBoxConfig 微信配置不存在 → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(paymentBox.saveBoxConfig(tenantId, {} as any, true)).rejects.toThrow("微信支付配置不存在");
  });
});

describe("payment-box.service - 签名/回调", () => {
  it("handleBoxCallback 缺密钥 → 拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ box_config: JSON.stringify({ enabled: true }) });
    const res = await paymentBox.handleBoxCallback({ tenantId, body: { outTradeNo: "B1", amount: 100, status: "SUCCESS", sign: "x" } });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("签名密钥");
  });

  it("handleBoxCallback 签名错误 → 拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox());
    const res = await paymentBox.handleBoxCallback({ tenantId, body: { outTradeNo: "B1", amount: 100, status: "SUCCESS", sign: "wrong" } });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("签名校验失败");
  });

  it("handleBoxCallback 签名正确且已支付 → 落收款", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox());
    const sign = crypto.createHash("md5").update("B1|100|abc").digest("hex");
    const res = await paymentBox.handleBoxCallback({ tenantId, body: { outTradeNo: "B1", amount: 100, status: "SUCCESS", sign } });
    expect(res.success).toBe(true);
    expect(res.orderNo).toBe("B1");
    expect(mocks.offlinePayment).toHaveBeenCalled();
  });

  it("handleBoxCallback 未支付 → 拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox());
    const sign = crypto.createHash("md5").update("B1|100|abc").digest("hex");
    const res = await paymentBox.handleBoxCallback({ tenantId, body: { outTradeNo: "B1", amount: 100, status: "FAILED", sign } });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("未支付");
  });

  it("handleBoxCallback 缺少单号/金额 → 拒绝", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox());
    const sign = crypto.createHash("md5").update(`|0|abc`).digest("hex");
    const res = await paymentBox.handleBoxCallback({ tenantId, body: { status: "SUCCESS", sign } });
    expect(res.success).toBe(false);
    expect(res.reason).toContain("缺少单号");
  });
});

describe("payment-box.service - 发起支付", () => {
  it("createBoxPayment 未配置 → 失败", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ box_config: JSON.stringify({ enabled: false }) });
    const res = await paymentBox.createBoxPayment({ tenantId, amount: 100, orderNo: "B1", subject: "x" });
    expect(res.success).toBe(false);
  });

  it("createBoxPayment 串口模式 → 返回 SERIAL", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox({ comPort: "COM1" }));
    const res = await paymentBox.createBoxPayment({ tenantId, amount: 100, orderNo: "B1", subject: "x" });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("SERIAL");
  });

  it("createBoxPayment HTTP 模式 → 调用 fetch", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(cfgBox({ apiUrl: "https://box.example/pay", secret: "abc" }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true}' });
    vi.stubGlobal("fetch", fetchMock);
    const res = await paymentBox.createBoxPayment({ tenantId, amount: 100, orderNo: "B1", subject: "x" });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("HTTP");
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
