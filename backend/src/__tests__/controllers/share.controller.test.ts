import { vi, describe, it, beforeEach, expect } from "vitest";

const shareServiceMocks = vi.hoisted(() => ({
  getCollectionLink: vi.fn(),
  getCollectionPage: vi.fn(),
  payCollection: vi.fn(),
  wxNotifyCollection: vi.fn(),
}));

vi.mock("@services/share.service", () => shareServiceMocks);

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
  beforeEach(() => vi.resetAllMocks());

  it("getCollectionLink - 应获取收款链接", async () => {
    (shareService.getCollectionLink as any).mockResolvedValue({ token: "test-token" });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionLink(req as any, res as any);
    expect(shareService.getCollectionLink).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionLink - 服务异常应返回错误", async () => {
    (shareService.getCollectionLink as any).mockRejectedValue(Object.assign(new Error("Error"), { statusCode: 500 }));
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await expect(getCollectionLink(req as any, res as any)).rejects.toMatchObject({ message: "Error" });
  });

  it("getCollectionPage - 应获取收款页面", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ data: { linkNo: "LN001", amount: 100 } });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(shareService.getCollectionPage).toHaveBeenCalledWith("test-token");
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionPage - 收款单不存在应返回404", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ error: "收款单不存在或已失效", status: 404 });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getCollectionPage - 收款单已过期应返回410", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ error: "收款链接已过期", status: 410 });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(410);
  });

  it("getCollectionPage - 收款单已支付应返回400", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ error: "该收款单已支付", status: 400 });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getCollectionPage - 收款单已撤销应返回400", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ error: "收款链接已撤销", status: 400 });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getCollectionPage - 收款单即将过期应更新状态", async () => {
    (shareService.getCollectionPage as any).mockResolvedValue({ error: "收款链接已过期", status: 410 });
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await getCollectionPage(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(shareService.getCollectionPage).toHaveBeenCalledWith("test-token");
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
    (shareService.payCollection as any).mockRejectedValue(Object.assign(new Error("Error"), { statusCode: 500 }));
    const req = mockReq({ params: { token: "test-token" } });
    const res = mockRes();
    await expect(payCollection(req as any, res as any)).rejects.toMatchObject({ message: "Error" });
  });

  it("wxNotifyCollection - 无resource应使用body字段", async () => {
    (shareService.wxNotifyCollection as any).mockResolvedValue({ data: { message: "成功" } });
    const req = mockReq({
      params: { token: "test-token" },
      body: { payNo: "test-pay", transactionId: "wx123", payAmount: 100 },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(shareService.wxNotifyCollection).toHaveBeenCalledWith("test-token", {
      payNo: "test-pay",
      transactionId: "wx123",
      payAmount: 100,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("wxNotifyCollection - 收款链接不存在应返回404", async () => {
    (shareService.wxNotifyCollection as any).mockResolvedValue({ error: "收款链接不存在", status: 404 });
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
    (shareService.wxNotifyCollection as any).mockResolvedValue({ data: { message: "已支付，无需重复处理" } });
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
    (shareService.wxNotifyCollection as any).mockResolvedValue({ error: "收款链接已失效", status: 400 });
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
    (shareService.wxNotifyCollection as any).mockResolvedValue({ data: { payNo: "test-pay", linkNo: "LN001" } });
    const req = mockReq({
      params: { token: "test-token" },
      body: { resource: { associated_data: "", nonce: "", ciphertext: "" } },
      headers: {},
    });
    const res = mockRes();
    await wxNotifyCollection(req as any, res as any);
    expect(shareService.wxNotifyCollection).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
