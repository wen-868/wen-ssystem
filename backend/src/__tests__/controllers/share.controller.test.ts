import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/share.service", () => ({
  getCollectionLink: vi.fn(),
  payCollection: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
}));

vi.mock("@shared/wechat-pay.js", () => {
  return {
    WechatPay: class {
      verifyNotifySignature() { return true; }
      decryptNotifyData() { return JSON.stringify({ out_trade_no: "test-pay", transaction_id: "wx123", amount: { payer_total: 1000 } }); }
    },
  };
});

import * as shareService from "@services/share.service";
import { ok } from "@shared/response";
import { getCollectionLink, getCollectionPage, payCollection, wxNotifyCollection } from "@controllers/share.controller";
import { query, queryOne } from "@shared/db";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("share.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCollectionLink - 应获取收款链接", async () => {
    (shareService.getCollectionLink as any).mockResolvedValue({ token: "test-token" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionLink(req as any, res as any);
    expect(shareService.getCollectionLink).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionLink - 服务异常应返回错误", async () => {
    (shareService.getCollectionLink as any).mockRejectedValue({ statusCode: 500, message: "Error" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionLink(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("getCollectionPage - 应获取收款页面", async () => {
    (queryOne as any).mockResolvedValue({ linkNo: "LN001", tenantId: "t1", sourceNo: "SB001", amount: 100, paidAmount: 0, status: "PENDING", expireAt: null });
    (query as any).mockResolvedValue([]);
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionPage - 收款单不存在应返回404", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getCollectionPage - 收款单已过期应返回410", async () => {
    (queryOne as any).mockResolvedValue({ linkNo: "LN001", tenantId: "t1", sourceNo: "SB001", amount: 100, paidAmount: 0, status: "EXPIRED", expireAt: "2020-01-01" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("getCollectionPage - 收款单已支付应返回400", async () => {
    (queryOne as any).mockResolvedValue({ linkNo: "LN001", tenantId: "t1", sourceNo: "SB001", amount: 100, paidAmount: 100, status: "PAID", expireAt: null });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getCollectionPage - 收款单已撤销应返回400", async () => {
    (queryOne as any).mockResolvedValue({ linkNo: "LN001", tenantId: "t1", sourceNo: "SB001", amount: 100, paidAmount: 0, status: "REVOKED", expireAt: null });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getCollectionPage - 收款单即将过期应更新状态", async () => {
    (queryOne as any).mockResolvedValue({ linkNo: "LN001", tenantId: "t1", sourceNo: "SB001", amount: 100, paidAmount: 0, status: "PENDING", expireAt: "2020-01-01" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(410);
    // 验证过期状态更新 SQL 包含 tenant_id 条件
    expect(query).toHaveBeenCalledWith(
      "UPDATE t_collection_link SET status = 'EXPIRED' WHERE link_no = ? AND tenant_id = ?",
      ["LN001", "t1"]
    );
  });

  it("payCollection - 应支付收款", async () => {
    (shareService.payCollection as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await payCollection(req as any, res as any);
    expect(shareService.payCollection).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });

  it("payCollection - 服务异常应返回错误", async () => {
    (shareService.payCollection as any).mockRejectedValue({ statusCode: 500, message: "Error" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await payCollection(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("wxNotifyCollection - 无resource应使用body字段", async () => {
    (queryOne as any).mockResolvedValue({ link_no: "LN001", tenant_id: "t1", source_no: "SB001", amount: 100, paid_amount: 0, status: "PENDING" });
    const req = mockReq({
      params: { token: "test-token" },
      body: { payNo: "test-pay", transactionId: "wx123", payAmount: 100 },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("wxNotifyCollection - 收款链接不存在应返回404", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq({
      params: { token: "test-token" },
      body: { payNo: "test-pay", transactionId: "wx123", payAmount: 100 },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("wxNotifyCollection - 已支付应返回成功", async () => {
    (queryOne as any).mockResolvedValue({ link_no: "LN001", tenant_id: "t1", source_no: "SB001", amount: 100, paid_amount: 100, status: "PAID" });
    const req = mockReq({
      params: { token: "test-token" },
      body: { payNo: "test-pay", transactionId: "wx123", payAmount: 100 },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("wxNotifyCollection - 链接已失效应返回400", async () => {
    (queryOne as any).mockResolvedValue({ link_no: "LN001", tenant_id: "t1", source_no: "SB001", amount: 100, paid_amount: 0, status: "REVOKED" });
    const req = mockReq({
      params: { token: "test-token" },
      body: { payNo: "test-pay", transactionId: "wx123", payAmount: 100 },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("wxNotifyCollection - 有resource应解密数据", async () => {
    (queryOne as any).mockResolvedValue({ link_no: "LN001", tenant_id: "t1", source_no: "SB001", amount: 100, paid_amount: 0, status: "PENDING" });
    const req = mockReq({
      params: { token: "test-token" },
      body: { resource: { associated_data: "", nonce: "", ciphertext: "" } },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
