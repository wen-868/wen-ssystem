import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.query,
  queryOneWithTenant: mocks.queryOne,
  query: mocks.query,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("../../../services/wechat-pay.service", () => ({
  createJsapiPayment: vi.fn(),
}));

import {
  getMyStoredCard,
  getMyStoredRecords,
  getRechargeOptions,
  createRecharge,
  completeRecharge,
} from "../../../services/miniapp/stored-card.service";

describe("miniapp stored-card.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("CV20260815001");
  });

  it("getMyStoredCard：返回卡信息", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      card_no: "CZ0001",
      customer_name: "张三",
      balance: 500,
      total_recharge: 800,
      total_consume: 300,
      status: "ACTIVE",
    });
    const result = await getMyStoredCard(1, "t1");
    expect(result?.cardNo).toBe("CZ0001");
    expect(result?.balance).toBe(500);
  });

  it("getMyStoredCard：无卡返回 null", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    expect(await getMyStoredCard(9, "t1")).toBeNull();
  });

  it("getRechargeOptions：返回默认档位", async () => {
    const options = await getRechargeOptions();
    expect(options.length).toBeGreaterThanOrEqual(4);
    expect(options[0].amount).toBe(100);
  });

  it("createRecharge：预创建交易并返回微信支付参数", async () => {
    const wechatMod = await import("../../../services/wechat-pay.service");
    (wechatMod.createJsapiPayment as any).mockResolvedValue({
      appId: "wx123",
      timeStamp: "1700000000",
      nonceStr: "nonce",
      package: "prepay_id=wxprepay1",
      signType: "RSA",
      paySign: "signed",
      prepayId: "wxprepay1",
    });
    mocks.queryOne.mockResolvedValueOnce({ card_no: "CZ0001", customer_name: "张三" });

    const result = await createRecharge({
      customerId: 1,
      tenantId: "t1",
      amount: 200,
      openid: "openid_abc",
    });

    expect(result.rechargeId).toBe("CV20260815001");
    expect(result.payParams.prepayId).toBe("wxprepay1");
    // 交易预创建
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_store_value_transaction"),
      expect.arrayContaining(["CV20260815001", "CZ0001", 1, 200])
    );
  });

  it("completeRecharge：支付成功更新卡余额与交易（幂等）", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ trans_no: "CV001", card_no: "CZ0001", amount: 200, remark: "PENDING_PAY" })
      .mockResolvedValueOnce({ balance: 500 });
    await completeRecharge("CV001", "t1");
    // 卡余额更新
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_store_value_card"),
      [700, 200, "CZ0001", "t1"]
    );
    // 交易更新
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_store_value_transaction"),
      [700, "CV001", "t1"]
    );
  });
});
