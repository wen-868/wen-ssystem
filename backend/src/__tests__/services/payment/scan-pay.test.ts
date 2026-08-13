/**
 * 收银台扫码支付（反扫）服务单元测试
 * 被测文件：src/services/payment/scan-pay.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  offlinePayment: vi.fn(),
  wechatV2: { payByAuthCode: vi.fn(), isOrderPaid: vi.fn() },
  alipayF2F: { payByAuthCode: vi.fn(), isOrderPaid: vi.fn() },
  unionpay: { payByAuthCode: vi.fn(), isOrderPaid: vi.fn() },
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../config/wechat-pay-v2", () => mocks.wechatV2);
vi.mock("../../../config/alipay-f2f", () => mocks.alipayF2F);
vi.mock("../../../services/hardware/unionpay.service", () => mocks.unionpay);
vi.mock("../../../services/store/sale-bill.service", () => ({
  offlinePayment: mocks.offlinePayment,
  paymentOnSaleBill: vi.fn(),
}));

import {
  detectChannel,
  maskAuthCode,
  payByCode,
  getPosChannels,
  CHANNEL_LABELS,
} from "../../../services/payment/scan-pay.service";

beforeEach(() => {
  mocks.queryOneWithTenant.mockReset();
  mocks.offlinePayment.mockReset();
  mocks.wechatV2.payByAuthCode.mockReset();
  mocks.wechatV2.isOrderPaid.mockReset();
  mocks.alipayF2F.payByAuthCode.mockReset();
  mocks.alipayF2F.isOrderPaid.mockReset();
  mocks.unionpay.payByAuthCode.mockReset();
  mocks.unionpay.isOrderPaid.mockReset();
});

describe("scan-pay - detectChannel", () => {
  it("微信 18 位 10~15 开头识别为 WECHAT", () => {
    expect(detectChannel("130123456789012345")).toBe("WECHAT");
  });

  it("支付宝 16~24 位 25~30 开头识别为 ALIPAY", () => {
    expect(detectChannel("2856123456789012")).toBe("ALIPAY");
  });

  it("云闪付 19 位 62 开头识别为 UNIONPAY", () => {
    expect(detectChannel("6212345678901234567")).toBe("UNIONPAY");
  });

  it("非纯数字/长度不符抛出错误", () => {
    expect(() => detectChannel("abc123")).toThrow("16~24 位纯数字");
    expect(() => detectChannel("880123456789012345")).toThrow("无法识别付款码渠道");
  });
});

describe("scan-pay - maskAuthCode", () => {
  it("付款码脱敏保留前 6 后 4", () => {
    expect(maskAuthCode("130123456789012345")).toBe("130123****2345");
  });
  it("过短付款码返回 ****", () => {
    expect(maskAuthCode("123")).toBe("****");
  });
});

describe("scan-pay - payByCode", () => {
  it("微信通道支付成功后落销售单收款并返回渠道信息", async () => {
    mocks.wechatV2.payByAuthCode.mockResolvedValue({ success: true, transactionId: "WX202608140001" });
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS202608140001", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await payByCode({
      billNo: "XS202608140001",
      amount: 98,
      authCode: "130123456789012345",
      userId: 4,
      username: "store_manager",
      tenantId: "default",
    });
    expect(res.channel).toBe("WECHAT");
    expect(res.channelLabel).toBe("微信");
    expect(res.transactionId).toBe("WX202608140001");
    expect(mocks.offlinePayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "WECHAT", transactionId: "WX202608140001" }));
  });

  it("支付宝通道支付成功", async () => {
    mocks.alipayF2F.payByAuthCode.mockResolvedValue({ success: true, transactionId: "ALIPAY202608140001" });
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS202608140001", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await payByCode({
      billNo: "XS202608140001",
      amount: 98,
      authCode: "2856123456789012",
      userId: 4,
      username: "store_manager",
      tenantId: "default",
    });
    expect(res.channel).toBe("ALIPAY");
    expect(mocks.offlinePayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "ALIPAY" }));
  });

  it("通道未配置时抛出明确错误且不落单", async () => {
    mocks.wechatV2.payByAuthCode.mockResolvedValue({ success: false, errCode: "CHANNEL_NOT_CONFIGURED", errMsg: "微信支付通道未配置" });
    mocks.wechatV2.isOrderPaid.mockResolvedValue(false);
    await expect(
      payByCode({
        billNo: "XS202608140001",
        amount: 98,
        authCode: "130123456789012345",
        userId: 4,
        username: "store_manager",
        tenantId: "default",
      })
    ).rejects.toThrow("微信支付通道未配置");
    expect(mocks.offlinePayment).not.toHaveBeenCalled();
  });

  it("通道报失败但订单实际已支付时仍落单（防重复扣款误报）", async () => {
    mocks.wechatV2.payByAuthCode.mockResolvedValue({ success: false, errCode: "ORDERPAID", errMsg: "订单已支付" });
    mocks.wechatV2.isOrderPaid.mockResolvedValue(true);
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS202608140001", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await payByCode({
      billNo: "XS202608140001",
      amount: 98,
      authCode: "130123456789012345",
      userId: 4,
      username: "store_manager",
      tenantId: "default",
    });
    expect(res.channel).toBe("WECHAT");
    expect(mocks.offlinePayment).toHaveBeenCalled();
  });

  it("云闪付通道支付成功", async () => {
    mocks.unionpay.payByAuthCode.mockResolvedValue({ success: true, transactionId: "UP202608140001" });
    mocks.offlinePayment.mockResolvedValue({ billNo: "XS202608140001", receivedAmount: 98, collectionStatus: "PAID" });
    const res = await payByCode({
      billNo: "XS202608140001",
      amount: 98,
      authCode: "6212345678901234567",
      userId: 4,
      username: "store_manager",
      tenantId: "default",
    });
    expect(res.channel).toBe("UNIONPAY");
    expect(mocks.unionpay.payByAuthCode).toHaveBeenCalled();
    expect(mocks.offlinePayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "UNIONPAY" }));
  });

  it("云闪付通道未配置时抛出明确错误", async () => {
    mocks.unionpay.payByAuthCode.mockResolvedValue({
      success: false,
      errCode: "CHANNEL_NOT_CONFIGURED",
      errMsg: "云闪付通道未配置",
    });
    mocks.unionpay.isOrderPaid.mockResolvedValue(false);
    await expect(
      payByCode({
        billNo: "XS202608140001",
        amount: 98,
        authCode: "6212345678901234567",
        userId: 4,
        username: "store_manager",
        tenantId: "default",
      })
    ).rejects.toThrow("云闪付通道未配置");
  });

  it("付款码格式不正确时抛出错误", async () => {
    await expect(
      payByCode({
        billNo: "XS202608140001",
        amount: 98,
        authCode: "123",
        userId: 4,
        username: "store_manager",
        tenantId: "default",
      })
    ).rejects.toThrow("16~24 位纯数字");
  });
});

describe("scan-pay - getPosChannels", () => {
  it("返回微信/支付宝/盒子渠道状态", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 1, app_id: "wx", mch_id: "mch", api_key: "key" });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 1, app_id: "ali" });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 1, box_config: '{"provider":"银盛","activationCode":"ACT123","enabled":true}' });
    const res = await getPosChannels("default");
    expect(res.wechat.ready).toBe(true);
    expect(res.alipay.ready).toBe(true);
    expect(res.box.ready).toBe(true);
    expect(res.box.provider).toBe("银盛");
    expect(res.hardware.cashDrawer).toBe(true);
  });

  it("未配置时各渠道 ready 为 false", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 0, app_id: "", mch_id: "", api_key: "" });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 0, app_id: "" });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ enabled: 0, box_config: null });
    const res = await getPosChannels("default");
    expect(res.wechat.ready).toBe(false);
    expect(res.alipay.ready).toBe(false);
    expect(res.box.ready).toBe(false);
  });
});

describe("scan-pay - CHANNEL_LABELS", () => {
  it("渠道中文名齐全", () => {
    expect(CHANNEL_LABELS.WECHAT).toBe("微信");
    expect(CHANNEL_LABELS.ALIPAY).toBe("支付宝");
    expect(CHANNEL_LABELS.BOX).toBe("收款盒子");
  });
});
