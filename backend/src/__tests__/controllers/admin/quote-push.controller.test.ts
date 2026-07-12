import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/quote-push.service", () => ({
  previewQuote: vi.fn(),
  createQuote: vi.fn(),
  listQuotes: vi.fn(),
  getQuoteDetail: vi.fn(),
  pushQuote: vi.fn(),
  cancelQuote: vi.fn(),
  viewQuoteByToken: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as quotePushService from "../../../services/admin/quote-push.service";
import { ok, fail } from "../../../shared/response";
import {
  previewQuote,
  createQuote,
  listQuotes,
  getQuoteDetail,
  pushQuote,
  cancelQuote,
  viewQuoteByToken,
} from "../../../controllers/admin/quote-push.controller";

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

describe("quote-push.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previewQuote - 应返回报价预览", async () => {
    (quotePushService.previewQuote as any).mockResolvedValue({ items: [] });
    const req = mockReq({
      body: {
        customerId: 1,
        categoryId: 2,
        brand: "茅台",
        keyword: "53度",
        priceLevelId: 3,
        minPrice: 100,
        maxPrice: 1000,
        skuIds: [1, 2, 3],
      },
    });
    const res = mockRes();
    await previewQuote(req as any, res as any);
    expect(quotePushService.previewQuote).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("previewQuote - 空参数应返回报价预览", async () => {
    (quotePushService.previewQuote as any).mockResolvedValue({ items: [] });
    const req = mockReq({ body: {} });
    const res = mockRes();
    await previewQuote(req as any, res as any);
    expect(quotePushService.previewQuote).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createQuote - 应创建报价单", async () => {
    (quotePushService.createQuote as any).mockResolvedValue({ id: 1, quoteNo: "Q001" });
    const req = mockReq({
      body: {
        customerId: 1,
        title: "测试报价单",
        remark: "备注",
        validDays: 7,
        items: [
          { skuId: 1, quotePrice: 100, minQty: 1 },
          { skuId: 2, quotePrice: 200, minQty: 2 },
        ],
      },
    });
    const res = mockRes();
    await createQuote(req as any, res as any);
    expect(quotePushService.createQuote).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createQuote - 参数校验失败应抛错", async () => {
    const req = mockReq({ body: { customerId: 1, items: [] } });
    const res = mockRes();
    await expect(createQuote(req as any, res as any)).rejects.toThrow();
    expect(quotePushService.createQuote).not.toHaveBeenCalled();
  });

  it("listQuotes - 应返回报价单列表", async () => {
    (quotePushService.listQuotes as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listQuotes(req as any, res as any);
    expect(quotePushService.listQuotes).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listQuotes - 应传递筛选参数", async () => {
    (quotePushService.listQuotes as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: {
        page: "2",
        pageSize: "10",
        customerId: "3",
        status: "ACTIVE",
        keyword: "测试",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
    });
    const res = mockRes();
    await listQuotes(req as any, res as any);
    expect(quotePushService.listQuotes).toHaveBeenCalledWith(
      2,
      10,
      "t1",
      expect.objectContaining({
        customerId: 3,
        status: "ACTIVE",
        keyword: "测试",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getQuoteDetail - 应返回报价单详情", async () => {
    (quotePushService.getQuoteDetail as any).mockResolvedValue({ id: 1, quoteNo: "Q001" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getQuoteDetail(req as any, res as any);
    expect(quotePushService.getQuoteDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getQuoteDetail - 报价单不存在应返回404", async () => {
    (quotePushService.getQuoteDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getQuoteDetail(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("报价单不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("pushQuote - 应推送报价单", async () => {
    (quotePushService.pushQuote as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { id: "1" },
      body: {
        channels: ["sms", "miniapp"],
        notifyText: "请查收报价单",
      },
    });
    const res = mockRes();
    await pushQuote(req as any, res as any);
    expect(quotePushService.pushQuote).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("pushQuote - 参数校验失败应抛错", async () => {
    const req = mockReq({ params: { id: "1" }, body: { channels: [] } });
    const res = mockRes();
    await expect(pushQuote(req as any, res as any)).rejects.toThrow();
    expect(quotePushService.pushQuote).not.toHaveBeenCalled();
  });

  it("cancelQuote - 应取消报价单", async () => {
    (quotePushService.cancelQuote as any).mockResolvedValue({ id: 1, status: "CANCELLED" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await cancelQuote(req as any, res as any);
    expect(quotePushService.cancelQuote).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("viewQuoteByToken - 应通过token查看报价单", async () => {
    (quotePushService.viewQuoteByToken as any).mockResolvedValue({ id: 1, quoteNo: "Q001" });
    const req = mockReq({ params: { token: "abc123" } });
    const res = mockRes();
    await viewQuoteByToken(req as any, res as any);
    expect(quotePushService.viewQuoteByToken).toHaveBeenCalledWith("abc123");
    expect(ok).toHaveBeenCalled();
  });

  it("viewQuoteByToken - token无效应返回404", async () => {
    (quotePushService.viewQuoteByToken as any).mockResolvedValue(null);
    const req = mockReq({ params: { token: "invalid" } });
    const res = mockRes();
    await viewQuoteByToken(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("报价单不存在或已过期", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
