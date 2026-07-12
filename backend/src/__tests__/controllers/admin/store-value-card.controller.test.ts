import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/store-value-card.service", () => ({
  listStoreValueCards: vi.fn(),
  createStoreValueCard: vi.fn(),
  getStoreValueCard: vi.fn(),
  rechargeCard: vi.fn(),
  consumeCard: vi.fn(),
  refundCard: vi.fn(),
  freezeCard: vi.fn(),
  unfreezeCard: vi.fn(),
  listStoreValueTransactions: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svcService from "../../../services/admin/store-value-card.service";
import { ok } from "../../../shared/response";
import {
  listStoreValueCards,
  createStoreValueCard,
  getStoreValueCard,
  rechargeCard,
  consumeCard,
  refundCard,
  freezeCard,
  unfreezeCard,
  listStoreValueTransactions,
} from "../../../controllers/admin/store-value-card.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("store-value-card.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listStoreValueCards - 应返回储值卡列表", async () => {
    (svcService.listStoreValueCards as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listStoreValueCards(req as any, res as any);
    expect(svcService.listStoreValueCards).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listStoreValueCards - 应传递筛选参数", async () => {
    (svcService.listStoreValueCards as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: { page: "2", pageSize: "10", customerId: "3", status: "ACTIVE" },
    });
    const res = mockRes();
    await listStoreValueCards(req as any, res as any);
    expect(svcService.listStoreValueCards).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        customerId: 3,
        status: "ACTIVE",
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("createStoreValueCard - 应创建储值卡", async () => {
    (svcService.createStoreValueCard as any).mockResolvedValue({ cardNo: "SVC001" });
    const req = mockReq({
      body: { customerId: 1, customerName: "张三", initialAmount: 1000 },
    });
    const res = mockRes();
    await createStoreValueCard(req as any, res as any);
    expect(svcService.createStoreValueCard).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 1,
        customerName: "张三",
        initialAmount: 1000,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("createStoreValueCard - service抛出异常应被捕获", async () => {
    const error = new Error("创建储值卡失败");
    (svcService.createStoreValueCard as any).mockRejectedValue(error);
    const req = mockReq({ body: { customerName: "张三", initialAmount: 1000 } });
    const res = mockRes();
    await expect(createStoreValueCard(req as any, res as any)).rejects.toThrow(error);
  });

  it("getStoreValueCard - 应返回储值卡详情", async () => {
    (svcService.getStoreValueCard as any).mockResolvedValue({ cardNo: "SVC001", balance: 1000 });
    const req = mockReq({ params: { cardNo: "SVC001" } });
    const res = mockRes();
    await getStoreValueCard(req as any, res as any);
    expect(svcService.getStoreValueCard).toHaveBeenCalledWith("SVC001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getStoreValueCard - 储值卡不存在应抛出异常", async () => {
    const error = new Error("储值卡不存在");
    (svcService.getStoreValueCard as any).mockRejectedValue(error);
    const req = mockReq({ params: { cardNo: "SVC999" } });
    const res = mockRes();
    await expect(getStoreValueCard(req as any, res as any)).rejects.toThrow(error);
  });

  it("rechargeCard - 应充值储值卡", async () => {
    (svcService.rechargeCard as any).mockResolvedValue({ cardNo: "SVC001", balance: 2000 });
    const req = mockReq({
      params: { cardNo: "SVC001" },
      body: { amount: 1000, payMethod: "WECHAT" },
    });
    const res = mockRes();
    await rechargeCard(req as any, res as any);
    expect(svcService.rechargeCard).toHaveBeenCalledWith(
      expect.objectContaining({
        cardNo: "SVC001",
        amount: 1000,
        payMethod: "WECHAT",
        operatorId: 1,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("rechargeCard - 充值失败应抛出异常", async () => {
    const error = new Error("充值失败");
    (svcService.rechargeCard as any).mockRejectedValue(error);
    const req = mockReq({ params: { cardNo: "SVC001" }, body: { amount: 1000, payMethod: "WECHAT" } });
    const res = mockRes();
    await expect(rechargeCard(req as any, res as any)).rejects.toThrow(error);
  });

  it("consumeCard - 应消费储值卡", async () => {
    (svcService.consumeCard as any).mockResolvedValue({ cardNo: "SVC001", balance: 900 });
    const req = mockReq({
      params: { cardNo: "SVC001" },
      body: { amount: 100, sourceNo: "SB001", remark: "消费" },
    });
    const res = mockRes();
    await consumeCard(req as any, res as any);
    expect(svcService.consumeCard).toHaveBeenCalledWith(
      expect.objectContaining({
        cardNo: "SVC001",
        amount: 100,
        sourceNo: "SB001",
        remark: "消费",
        operatorId: 1,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("consumeCard - 余额不足应抛出异常", async () => {
    const error = new Error("余额不足");
    (svcService.consumeCard as any).mockRejectedValue(error);
    const req = mockReq({ params: { cardNo: "SVC001" }, body: { amount: 10000, sourceNo: "SB001" } });
    const res = mockRes();
    await expect(consumeCard(req as any, res as any)).rejects.toThrow(error);
  });

  it("refundCard - 应退回收储值卡", async () => {
    (svcService.refundCard as any).mockResolvedValue({ cardNo: "SVC001", balance: 0 });
    const req = mockReq({
      params: { cardNo: "SVC001" },
      body: { amount: 1000, remark: "退回收" },
    });
    const res = mockRes();
    await refundCard(req as any, res as any);
    expect(svcService.refundCard).toHaveBeenCalledWith(
      expect.objectContaining({
        cardNo: "SVC001",
        amount: 1000,
        remark: "退回收",
        operatorId: 1,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("freezeCard - 应冻结储值卡", async () => {
    (svcService.freezeCard as any).mockResolvedValue({ cardNo: "SVC001", status: "FROZEN" });
    const req = mockReq({ params: { cardNo: "SVC001" } });
    const res = mockRes();
    await freezeCard(req as any, res as any);
    expect(svcService.freezeCard).toHaveBeenCalledWith("SVC001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("unfreezeCard - 应解冻储值卡", async () => {
    (svcService.unfreezeCard as any).mockResolvedValue({ cardNo: "SVC001", status: "ACTIVE" });
    const req = mockReq({ params: { cardNo: "SVC001" } });
    const res = mockRes();
    await unfreezeCard(req as any, res as any);
    expect(svcService.unfreezeCard).toHaveBeenCalledWith("SVC001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listStoreValueTransactions - 应返回储值卡交易记录", async () => {
    (svcService.listStoreValueTransactions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { cardNo: "SVC001" }, query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listStoreValueTransactions(req as any, res as any);
    expect(svcService.listStoreValueTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        cardNo: "SVC001",
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("freezeCard - 冻结失败应抛出异常", async () => {
    const error = new Error("冻结失败");
    (svcService.freezeCard as any).mockRejectedValue(error);
    const req = mockReq({ params: { cardNo: "SVC001" } });
    const res = mockRes();
    await expect(freezeCard(req as any, res as any)).rejects.toThrow(error);
  });

  // ==================== 分支覆盖率补充测试 ====================
  it("listStoreValueCards - 不传page/pageSize/customerId时使用默认值", async () => {
    (svcService.listStoreValueCards as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listStoreValueCards(req as any, res as any);
    expect(svcService.listStoreValueCards).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, customerId: undefined, tenantId: "t1"
    }));
  });

  it("listStoreValueTransactions - 不传page/pageSize时使用默认值", async () => {
    (svcService.listStoreValueTransactions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { cardNo: "SVC001" }, query: {} });
    const res = mockRes();
    await listStoreValueTransactions(req as any, res as any);
    expect(svcService.listStoreValueTransactions).toHaveBeenCalledWith(expect.objectContaining({
      cardNo: "SVC001", page: 1, pageSize: 20, tenantId: "t1"
    }));
  });
});