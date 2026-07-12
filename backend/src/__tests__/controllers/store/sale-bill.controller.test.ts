import { vi, describe, it, beforeEach, expect } from "vitest";
import { z, ZodError } from "zod";

vi.mock("../../../services/store/sale-bill.service", () => ({
  listSaleBills: vi.fn(),
  getSaleBillDetail: vi.fn(),
  createSaleBill: vi.fn(),
  createCollectionLink: vi.fn(),
  offlinePayment: vi.fn(),
  paymentOnSaleBill: vi.fn(),
  listOverdueBills: vi.fn(),
  checkOverdueBills: vi.fn(),
}));

vi.mock("../../../routes/store-sale-bill.routes", () => {
  const storeSaleBillItemSchema = z.object({
    skuId: z.number(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
  });
  return { storeSaleBillItemSchema };
});

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as saleBillService from "../../../services/store/sale-bill.service";
import { ok, fail } from "../../../shared/response";
import { listSaleBills, getSaleBillDetail, createSaleBill, createCollectionLink, offlinePayment, paymentOnSaleBill, listOverdueBills, checkOverdueBills } from "../../../controllers/store/sale-bill.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/sale-bill.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listSaleBills - 应返回销售单列表", async () => {
    (saleBillService.listSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20, keyword: "测试", collectionStatus: "UNCOLLECTED" } });
    const res = mockRes();
    await listSaleBills(req as any, res as any);
    expect(saleBillService.listSaleBills).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      storeId: 1,
      keyword: "测试",
      collectionStatus: "UNCOLLECTED",
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getSaleBillDetail - 销售单不存在应返回404", async () => {
    (saleBillService.getSaleBillDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { billNo: "BILL999" } });
    const res = mockRes();
    await getSaleBillDetail(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("销售单不存在", "404");
  });

  it("getSaleBillDetail - 应返回销售单详情", async () => {
    (saleBillService.getSaleBillDetail as any).mockResolvedValue({ billNo: "BILL001" });
    const req = mockReq({ params: { billNo: "BILL001" } });
    const res = mockRes();
    await getSaleBillDetail(req as any, res as any);
    expect(saleBillService.getSaleBillDetail).toHaveBeenCalledWith("BILL001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createSaleBill - 应创建销售单", async () => {
    (saleBillService.createSaleBill as any).mockResolvedValue({ billNo: "BILL001" });
    const req = mockReq({ body: { items: [{ skuId: 1, quantity: 1, unitPrice: 100 }] } });
    const res = mockRes();
    await createSaleBill(req as any, res as any);
    expect(saleBillService.createSaleBill).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 1,
      userId: 1,
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("createCollectionLink - 应创建收款链接", async () => {
    (saleBillService.createCollectionLink as any).mockResolvedValue({ linkId: "LINK001" });
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100 } });
    const res = mockRes();
    await createCollectionLink(req as any, res as any);
    expect(saleBillService.createCollectionLink).toHaveBeenCalledWith(expect.objectContaining({
      billNo: "BILL001",
      amount: 100,
      userId: 1,
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("offlinePayment - 应线下收款", async () => {
    (saleBillService.offlinePayment as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100, paymentMethod: "CASH" } });
    const res = mockRes();
    await offlinePayment(req as any, res as any);
    expect(saleBillService.offlinePayment).toHaveBeenCalledWith(expect.objectContaining({
      billNo: "BILL001",
      amount: 100,
      paymentMethod: "CASH",
      userId: 1,
      username: "storeuser",
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("paymentOnSaleBill - 应销售单收款", async () => {
    (saleBillService.paymentOnSaleBill as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100, paymentMethod: "ALIPAY" } });
    const res = mockRes();
    await paymentOnSaleBill(req as any, res as any);
    expect(saleBillService.paymentOnSaleBill).toHaveBeenCalledWith(expect.objectContaining({
      billNo: "BILL001",
      amount: 100,
      paymentMethod: "ALIPAY",
      userId: 1,
      username: "storeuser",
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listOverdueBills - 应返回逾期账单列表", async () => {
    (saleBillService.listOverdueBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listOverdueBills(req as any, res as any);
    expect(saleBillService.listOverdueBills).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      storeId: 1,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("checkOverdueBills - 应检查逾期账单", async () => {
    (saleBillService.checkOverdueBills as any).mockResolvedValue({ count: 3 });
    const req = mockReq();
    const res = mockRes();
    await checkOverdueBills(req as any, res as any);
    expect(saleBillService.checkOverdueBills).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createSaleBill - items 为空数组应抛出 ZodError", async () => {
    const req = mockReq({ body: { items: [] } });
    const res = mockRes();
    await expect(createSaleBill(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createSaleBill).not.toHaveBeenCalled();
  });

  it("createSaleBill - items 缺失应抛出 ZodError", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createSaleBill(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createSaleBill).not.toHaveBeenCalled();
  });

  it("createSaleBill - saleType 无效值应抛出 ZodError", async () => {
    const req = mockReq({ body: { items: [{ skuId: 1 }], saleType: "INVALID" } });
    const res = mockRes();
    await expect(createSaleBill(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createSaleBill).not.toHaveBeenCalled();
  });

  it("createCollectionLink - amount 缺失应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: {} });
    const res = mockRes();
    await expect(createCollectionLink(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createCollectionLink).not.toHaveBeenCalled();
  });

  it("createCollectionLink - shareChannel 无效值应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100, shareChannel: "INVALID" } });
    const res = mockRes();
    await expect(createCollectionLink(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createCollectionLink).not.toHaveBeenCalled();
  });

  it("createCollectionLink - taxRate 超出范围应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100, taxRate: 2 } });
    const res = mockRes();
    await expect(createCollectionLink(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.createCollectionLink).not.toHaveBeenCalled();
  });

  it("offlinePayment - amount 缺失应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { paymentMethod: "CASH" } });
    const res = mockRes();
    await expect(offlinePayment(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.offlinePayment).not.toHaveBeenCalled();
  });

  it("offlinePayment - paymentMethod 缺失应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100 } });
    const res = mockRes();
    await expect(offlinePayment(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.offlinePayment).not.toHaveBeenCalled();
  });

  it("paymentOnSaleBill - amount 非正数应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 0, paymentMethod: "CASH" } });
    const res = mockRes();
    await expect(paymentOnSaleBill(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.paymentOnSaleBill).not.toHaveBeenCalled();
  });

  it("paymentOnSaleBill - paymentMethod 无效值应抛出 ZodError", async () => {
    const req = mockReq({ params: { billNo: "BILL001" }, body: { amount: 100, paymentMethod: "INVALID" } });
    const res = mockRes();
    await expect(paymentOnSaleBill(req as any, res as any)).rejects.toThrow(ZodError);
    expect(saleBillService.paymentOnSaleBill).not.toHaveBeenCalled();
  });
});
