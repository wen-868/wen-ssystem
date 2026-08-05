/**
 * 管理端微信支付 service 单元测试
 * 被测文件：src/services/admin/payment.service.ts
 * 覆盖全部 5 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  env: {
    WECHAT_APP_ID: "wx_test_app_id",
  },
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("../../../shared/env", () => ({
  env: mocks.env,
}));

import {
  createPaymentOrder,
  handleWxCallback,
  createRefund,
  getPaymentOrder,
  listPaymentOrders,
} from "../../../services/admin/payment.service";

const mockConn = { execute: vi.fn() };

const wechatPay = {
  createJsapiOrder: vi.fn(),
  verifyNotifySignature: vi.fn(),
  decryptNotifyData: vi.fn(),
  createRefund: vi.fn(),
} as any;

beforeEach(() => {
  mocks.query.mockReset();
  mocks.queryOne.mockReset();
  mocks.transaction.mockReset();
  mocks.makeBizNo.mockReset();
  mockConn.execute.mockReset();
  wechatPay.createJsapiOrder.mockReset();
  wechatPay.verifyNotifySignature.mockReset();
  wechatPay.decryptNotifyData.mockReset();
  wechatPay.createRefund.mockReset();
  mocks.makeBizNo.mockReturnValue("ZF20260709001");
  mocks.transaction.mockImplementation(async (cb: (c: any) => Promise<unknown>) => cb(mockConn));
});

// ============ createPaymentOrder ============
describe("admin payment.service - createPaymentOrder", () => {
  it("无 openid → dev mode（if 左分支 + description || 右分支）", async () => {
    mocks.query.mockResolvedValue({});
    const res = await createPaymentOrder(
      { sourceType: "SALE_BILL", sourceNo: "XS001", amount: 1000 },
      "t1",
      wechatPay
    );
    expect(res.payNo).toBe("ZF20260709001");
    expect(res.appId).toBe("wx_test_app_id");
    expect(res.package).toBe("prepay_id=dev");
    expect(res.paySign).toBe("dev-sign");
    expect(wechatPay.createJsapiOrder).not.toHaveBeenCalled();
  });

  it("有 openid → 调用微信支付（if 右分支 + description || 左分支）", async () => {
    mocks.query.mockResolvedValue({});
    wechatPay.createJsapiOrder.mockResolvedValue({
      prepayId: "prepay123", paySign: "sign456", timeStamp: "1234567890", nonceStr: "nonce789"
    });
    const res = await createPaymentOrder(
      { sourceType: "SALE_BILL", sourceNo: "XS001", amount: 1000, openid: "wx_openid", description: "测试支付" },
      "t1",
      wechatPay
    );
    expect(res.payNo).toBe("ZF20260709001");
    expect(res.package).toBe("prepay_id=prepay123");
    expect(res.paySign).toBe("sign456");
    expect(wechatPay.createJsapiOrder).toHaveBeenCalledOnce();
  });

  it("有 openid 但无 description → description || 右分支", async () => {
    mocks.query.mockResolvedValue({});
    wechatPay.createJsapiOrder.mockResolvedValue({
      prepayId: "prepay456", paySign: "sign789", timeStamp: "1234567891", nonceStr: "nonce012"
    });
    const res = await createPaymentOrder(
      { sourceType: "MINIAPP_ORDER", sourceNo: "MO001", amount: 500, openid: "wx_openid2" },
      "t1",
      wechatPay
    );
    expect(res.payNo).toBe("ZF20260709001");
    expect(wechatPay.createJsapiOrder).toHaveBeenCalledOnce();
    // 验证 createJsapiOrder 被调用时 description 参数使用了默认值
    const callArgs = wechatPay.createJsapiOrder.mock.calls[0][0];
    expect(callArgs.description).toContain("支付订单");
  });
});

// ============ handleWxCallback ============
describe("admin payment.service - handleWxCallback", () => {
  it("签名验证失败 → 返回 400", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(false);
    const res = await handleWxCallback({}, {}, wechatPay);
    expect(res.success).toBe(false);
    expect(res.code).toBe("400");
    expect(res.message).toBe("签名验证失败");
  });

  it("解密失败 → 返回 400（catch 分支）", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockImplementation(() => {
      throw new Error("解密失败");
    });
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(false);
    expect(res.message).toBe("数据解密失败");
  });

  it("trade_state 非 SUCCESS → 直接返回成功（不进 transaction）", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF001", transaction_id: "tx001", trade_state: "NOT_SUCCESS", amount: { total: 100000 }
    }));
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("trade_state = SUCCESS + SALE_BILL → 执行事务更新销售单", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF001", transaction_id: "tx001", trade_state: "SUCCESS", amount: { total: 100000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([[{ source_type: "SALE_BILL", source_no: "XS001" }], {}])  // SELECT source
      .mockResolvedValueOnce({});  // UPDATE t_sale_bill
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mockConn.execute).toHaveBeenCalledTimes(4);
  });

  it("trade_state = SUCCESS + MINIAPP_ORDER → 执行事务更新小程序订单", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF002", transaction_id: "tx002", trade_state: "SUCCESS", amount: { total: 50000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([[{ source_type: "MINIAPP_ORDER", source_no: "MO001" }], {}])  // SELECT source
      .mockResolvedValueOnce({});  // UPDATE t_miniapp_order
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
  });

  it("trade_state = SUCCESS + COLLECTION_LINK → 执行事务更新收款链接", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF003", transaction_id: "tx003", trade_state: "SUCCESS", amount: { total: 20000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([[{ source_type: "COLLECTION_LINK", source_no: "CL001" }], {}])  // SELECT source
      .mockResolvedValueOnce({});  // UPDATE t_collection_link
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
  });

  it("trade_state = SUCCESS + 订单数据为空数组 → 不执行 source 更新", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF004", transaction_id: "tx004", trade_state: "SUCCESS", amount: { total: 10000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([[], {}]);  // SELECT → 空数组（order[0] truthy 但 length=0）
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });

  it("trade_state = SUCCESS + order[0] 为 undefined → 不执行 source 更新", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF005", transaction_id: "tx005", trade_state: "SUCCESS", amount: { total: 8000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([undefined, {}]);  // SELECT → order[0] = undefined（falsy 短路）
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });

  it("trade_state = SUCCESS + 其他 source_type → 所有 else if false 分支", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF006", transaction_id: "tx006", trade_state: "SUCCESS", amount: { total: 5000 }
    }));
    mockConn.execute
      .mockResolvedValueOnce([[{ status: "PENDING" }], {}])  // 幂等检查：未处理过
      .mockResolvedValueOnce({})  // UPDATE t_payment_order
      .mockResolvedValueOnce([[{ source_type: "OTHER", source_no: "OT001" }], {}]);  // SELECT
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(3);  // 幂等检查 + UPDATE + SELECT，无业务表更新
  });

  it("trade_state = SUCCESS + 支付单已 PAID → 幂等跳过，不重复累加", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF007", transaction_id: "tx007", trade_state: "SUCCESS", amount: { total: 20000 }
    }));
    mockConn.execute.mockResolvedValueOnce([[{ status: "PAID" }], {}]);  // 幂等检查：已处理过
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(1);  // 只做幂等检查，不再执行任何更新
  });

  it("trade_state = SUCCESS + 支付单已 SUCCESS → 幂等跳过，不重复累加", async () => {
    wechatPay.verifyNotifySignature.mockReturnValue(true);
    wechatPay.decryptNotifyData.mockReturnValue(JSON.stringify({
      out_trade_no: "ZF008", transaction_id: "tx008", trade_state: "SUCCESS", amount: { total: 20000 }
    }));
    mockConn.execute.mockResolvedValueOnce([[{ status: "SUCCESS" }], {}]);  // 幂等检查：已处理过
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } }, wechatPay);
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });
});

// ============ createRefund ============
describe("admin payment.service - createRefund", () => {
  it("支付订单不存在 → 返回 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    const res = await createRefund({ payNo: "ZF999", amount: 100, reason: "退款" }, "t1", wechatPay);
    expect(res.success).toBe(false);
    expect(res.code).toBe("404");
  });

  it("订单未支付 → 返回 400", async () => {
    mocks.queryOne.mockResolvedValue({ amount: 1000, status: "PENDING", transaction_id: "tx001" });
    const res = await createRefund({ payNo: "ZF001", amount: 100, reason: "退款" }, "t1", wechatPay);
    expect(res.success).toBe(false);
    expect(res.code).toBe("400");
  });

  it("退款金额超过支付金额 → 返回 400", async () => {
    mocks.queryOne.mockResolvedValue({ amount: 50, status: "PAID", transaction_id: "tx001" });
    const res = await createRefund({ payNo: "ZF001", amount: 100, reason: "退款" }, "t1", wechatPay);
    expect(res.success).toBe(false);
    expect(res.code).toBe("400");
  });

  it("成功退款", async () => {
    mocks.queryOne.mockResolvedValue({ amount: 1000, status: "PAID", transaction_id: "tx001" });
    wechatPay.createRefund.mockResolvedValue({});
    mocks.query.mockResolvedValue({});
    const res = await createRefund({ payNo: "ZF001", amount: 500, reason: "测试退款" }, "t1", wechatPay);
    expect(res.success).toBe(true);
    expect(res.data!.status).toBe("PROCESSING");
    expect(wechatPay.createRefund).toHaveBeenCalledOnce();
  });
});

// ============ getPaymentOrder ============
describe("admin payment.service - getPaymentOrder", () => {
  it("返回支付订单", async () => {
    mocks.queryOne.mockResolvedValue({ pay_no: "ZF001", amount: 1000, status: "PAID" });
    const res = await getPaymentOrder("ZF001", "t1");
    expect(res.pay_no).toBe("ZF001");
  });
});

// ============ listPaymentOrders ============
describe("admin payment.service - listPaymentOrders", () => {
  it("有 status 筛选（if 左分支）", async () => {
    mocks.query.mockResolvedValue([{ pay_no: "ZF001", status: "PAID" }]);
    const res = await listPaymentOrders("t1", 1, 10, "PAID");
    expect(res).toEqual([{ pay_no: "ZF001", status: "PAID" }]);
  });

  it("无 status 筛选（if 右分支）", async () => {
    mocks.query.mockResolvedValue([]);
    const res = await listPaymentOrders("t1", 1, 10);
    expect(res).toEqual([]);
  });
});
