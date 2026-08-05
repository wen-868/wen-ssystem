/**
 * 储值卡 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/store-value-card.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  createStoreValueCard,
  listStoreValueCards,
  getStoreValueCard,
  rechargeCard,
  consumeCard,
  refundCard,
  freezeCard,
  unfreezeCard,
  listStoreValueTransactions,
} from "../../../services/admin/store-value-card.service";

const activeCard = {
  cardNo: "CZ001",
  customerId: 1,
  customerName: "张三",
  balance: "100",
  totalRecharge: "100",
  totalConsume: "0",
  status: "ACTIVE",
  createdAt: "2026-01-01",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.makeBizNo.mockReturnValue("CZ202608060001");
});

describe("store-value-card.service - createStoreValueCard", () => {
  it("客户已有储值卡时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ card_no: "CZ001" });
    await expect(createStoreValueCard({ customerId: 1, tenantId: "t1" })).rejects.toThrow("该客户已有储值卡");
  });

  it("无初始金额时不生成交易流水", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await createStoreValueCard({ customerId: 1, customerName: "张三", tenantId: "t1" });
    expect(res).toEqual({ cardNo: "CZ202608060001", customerId: 1, balance: 0 });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("有初始金额时生成充值流水", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.makeBizNo.mockReturnValueOnce("CZ001").mockReturnValueOnce("SV001");
    const res = await createStoreValueCard({ customerId: 1, initialAmount: 500, tenantId: "t1" });
    expect(res).toEqual({ cardNo: "CZ001", customerId: 1, balance: 500 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("'RECHARGE'");
  });
});

describe("store-value-card.service - listStoreValueCards", () => {
  it("customerId/status 筛选与分页", async () => {
    mocks.queryWithTenant.mockResolvedValue([activeCard]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listStoreValueCards({ customerId: 1, status: "ACTIVE", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [activeCard] });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("customer_id = ?");
    expect(sql).toContain("status = ?");
  });
});

describe("store-value-card.service - getStoreValueCard", () => {
  it("不存在时抛错，存在时返回卡片", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getStoreValueCard("CZ999", "t1")).rejects.toThrow("储值卡不存在");
    mocks.queryOneWithTenant.mockResolvedValue(activeCard);
    const res = await getStoreValueCard("CZ001", "t1");
    expect(res.cardNo).toBe("CZ001");
  });
});

describe("store-value-card.service - 充值/消费/退款", () => {
  it("rechargeCard 状态异常时抛错，正常时更新余额并记流水", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ ...activeCard, status: "FROZEN" });
    await expect(rechargeCard({ cardNo: "CZ001", amount: 100, operatorId: 1, tenantId: "t1" }))
      .rejects.toThrow("储值卡状态异常");

    mocks.queryOneWithTenant.mockResolvedValue(activeCard);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.makeBizNo.mockReturnValueOnce("SV002");
    const res = await rechargeCard({ cardNo: "CZ001", amount: 50, payMethod: "WECHAT", operatorId: 1, tenantId: "t1" });
    expect(res).toEqual({ cardNo: "CZ001", transNo: "SV002", amount: 50, balanceAfter: 150 });
  });

  it("consumeCard 余额不足时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ ...activeCard, balance: "10" });
    await expect(consumeCard({ cardNo: "CZ001", amount: 20, operatorId: 1, tenantId: "t1" }))
      .rejects.toThrow("余额不足");
  });

  it("consumeCard 正常消费并记负数流水", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(activeCard);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.makeBizNo.mockReturnValueOnce("SV003");
    const res = await consumeCard({ cardNo: "CZ001", amount: 30, sourceNo: "XS001", remark: "消费", operatorId: 1, tenantId: "t1" });
    expect(res).toEqual({ cardNo: "CZ001", transNo: "SV003", amount: 30, balanceAfter: 70 });
    const params = mocks.queryWithTenant.mock.calls[1][1] as unknown[];
    expect(params[4]).toBe(-30);
  });

  it("refundCard 正常退款", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(activeCard);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.makeBizNo.mockReturnValueOnce("SV004");
    const res = await refundCard({ cardNo: "CZ001", amount: 20, operatorId: 1, tenantId: "t1" });
    expect(res.balanceAfter).toBe(120);
    const params = mocks.queryWithTenant.mock.calls[1][1] as unknown[];
    expect(params[3]).toBe("REFUND");
  });
});

describe("store-value-card.service - 冻结/解冻/流水", () => {
  it("freezeCard 状态非 ACTIVE 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ ...activeCard, status: "FROZEN" });
    await expect(freezeCard("CZ001", "t1")).rejects.toThrow("储值卡状态异常");
  });

  it("freezeCard 成功冻结", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(activeCard);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await freezeCard("CZ001", "t1");
    expect(res).toEqual({ cardNo: "CZ001", status: "FROZEN" });
  });

  it("unfreezeCard 不存在/未冻结时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(unfreezeCard("CZ001", "t1")).rejects.toThrow("储值卡不存在");
    mocks.queryOneWithTenant.mockResolvedValue({ card_no: "CZ001", status: "ACTIVE" });
    await expect(unfreezeCard("CZ001", "t1")).rejects.toThrow("储值卡未冻结");
  });

  it("unfreezeCard 成功解冻", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ card_no: "CZ001", status: "FROZEN" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await unfreezeCard("CZ001", "t1");
    expect(res).toEqual({ cardNo: "CZ001", status: "ACTIVE" });
  });

  it("listStoreValueTransactions 返回流水", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ transNo: "SV1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listStoreValueTransactions({ cardNo: "CZ001", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ transNo: "SV1" }] });
  });
});
