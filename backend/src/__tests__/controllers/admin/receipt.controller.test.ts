import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/receipt.service.js", () => ({
  createReceipt: vi.fn(),
  listReceipts: vi.fn(),
  getReceiptDetail: vi.fn(),
  writeoffReceipt: vi.fn(),
  voidReceipt: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as receiptService from "../../../services/admin/receipt.service.js";
import { ok } from "../../../shared/response.js";
import {
  createReceipt, listReceipts, getReceiptDetail, writeoffReceipt, voidReceipt
} from "../../../controllers/admin/receipt.controller.js";

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

describe("receipt.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createReceipt - 应创建收款单", async () => {
    (receiptService.createReceipt as any).mockResolvedValue({ receiptNo: "R001" });
    const req = mockReq({
      body: {
        customerId: 1, customerName: "客户A", receiptType: "RECEIPT",
        amount: 1000, paymentMethod: "BANK_TRANSFER", bankAccountId: 1,
        receivedDate: "2026-07-11", remark: "测试收款"
      }
    });
    const res = mockRes();
    await createReceipt(req as any, res as any);
    expect(receiptService.createReceipt).toHaveBeenCalledWith({
      customerId: 1, customerName: "客户A", receiptType: "RECEIPT",
      amount: 1000, paymentMethod: "BANK_TRANSFER", bankAccountId: 1,
      receivedDate: "2026-07-11", remark: "测试收款",
      operatorId: 1, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listReceipts - 应返回收款单列表", async () => {
    (receiptService.listReceipts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listReceipts(req as any, res as any);
    expect(receiptService.listReceipts).toHaveBeenCalledWith({
      customerId: undefined, status: undefined, page: 1, pageSize: 20, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getReceiptDetail - 应返回收款单详情", async () => {
    (receiptService.getReceiptDetail as any).mockResolvedValue({ receiptNo: "R001" });
    const req = mockReq({ params: { receiptNo: "R001" } });
    const res = mockRes();
    await getReceiptDetail(req as any, res as any);
    expect(receiptService.getReceiptDetail).toHaveBeenCalledWith("R001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("writeoffReceipt - 应核销收款单", async () => {
    (receiptService.writeoffReceipt as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { receiptNo: "R001" }, body: { receivableId: 2, writeoffAmount: 500 } });
    const res = mockRes();
    await writeoffReceipt(req as any, res as any);
    expect(receiptService.writeoffReceipt).toHaveBeenCalledWith("R001", 2, 500, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("voidReceipt - 应作废收款单", async () => {
    (receiptService.voidReceipt as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { receiptNo: "R001" } });
    const res = mockRes();
    await voidReceipt(req as any, res as any);
    expect(receiptService.voidReceipt).toHaveBeenCalledWith("R001", "t1");
    expect(ok).toHaveBeenCalled();
  });
});
