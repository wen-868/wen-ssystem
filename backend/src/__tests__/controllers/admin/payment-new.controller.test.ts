/**
 * 管理端付款 controller 单元测试
 * 被测文件：src/controllers/admin/payment-new.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  createPayment: vi.fn(),
  listPayments: vi.fn(),
  getPaymentDetail: vi.fn(),
  writeoffPayment: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/payment-new.service.js", () => ({
  createPayment: mocks.createPayment,
  listPayments: mocks.listPayments,
  getPaymentDetail: mocks.getPaymentDetail,
  writeoffPayment: mocks.writeoffPayment,
  voidPayment: mocks.voidPayment,
}));

import {
  createPayment,
  listPayments,
  getPaymentDetail,
  writeoffPayment,
  voidPayment,
} from "../../../controllers/admin/payment-new.controller.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin payment-new.controller", () => {
  it("createPayment 成功创建付款单并传递 operatorId", async () => {
    mocks.createPayment.mockResolvedValue({ paymentNo: "P001" });
    const req = mockReq({
      body: {
        supplierId: 1,
        supplierName: "供应商A",
        paymentType: "PURCHASE",
        amount: 1000,
        paymentMethod: "BANK_TRANSFER",
        bankAccountId: 2,
        paidDate: "2026-07-11",
        remark: "预付款",
      },
    });
    const res = mockRes();
    await createPayment(req, res);
    expect(mocks.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: 1,
      supplierName: "供应商A",
      amount: 1000,
      operatorId: 1,
      tenantId: "t1",
    }));
    expect(res.json).toHaveBeenCalled();
  });

  it("createPayment body 字段缺失时传递 undefined", async () => {
    mocks.createPayment.mockResolvedValue({ paymentNo: "P002" });
    const req = mockReq({ body: { amount: 500 } });
    const res = mockRes();
    await createPayment(req, res);
    expect(mocks.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: undefined,
      amount: 500,
      operatorId: 1,
      tenantId: "t1",
    }));
  });

  it("listPayments 传递查询参数（含 supplierId）", async () => {
    mocks.listPayments.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({
      query: { supplierId: "5", paymentType: "PURCHASE", status: "PAID", page: "2", pageSize: "10" },
    });
    const res = mockRes();
    await listPayments(req, res);
    expect(mocks.listPayments).toHaveBeenCalledWith({
      supplierId: 5,
      paymentType: "PURCHASE",
      status: "PAID",
      page: 2,
      pageSize: 10,
      tenantId: "t1",
    });
  });

  it("listPayments supplierId 缺失时传 undefined 并使用默认分页", async () => {
    mocks.listPayments.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listPayments(req, res);
    expect(mocks.listPayments).toHaveBeenCalledWith({
      supplierId: undefined,
      paymentType: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
      tenantId: "t1",
    });
  });

  it("getPaymentDetail 传 paymentNo 与 tenantId", async () => {
    mocks.getPaymentDetail.mockResolvedValue({ paymentNo: "P001", amount: 1000 });
    const req = mockReq({ params: { paymentNo: "P001" } });
    const res = mockRes();
    await getPaymentDetail(req, res);
    expect(mocks.getPaymentDetail).toHaveBeenCalledWith("P001", "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("writeoffPayment 传递付款单号、应付单号和核销金额", async () => {
    mocks.writeoffPayment.mockResolvedValue({ writeoffId: 1 });
    const req = mockReq({
      params: { paymentNo: "P001" },
      body: { payableId: 10, writeoffAmount: 500 },
    });
    const res = mockRes();
    await writeoffPayment(req, res);
    expect(mocks.writeoffPayment).toHaveBeenCalledWith("P001", 10, 500, "t1");
  });

  it("voidPayment 传 paymentNo 与 tenantId", async () => {
    mocks.voidPayment.mockResolvedValue({ paymentNo: "P001", status: "VOID" });
    const req = mockReq({ params: { paymentNo: "P001" } });
    const res = mockRes();
    await voidPayment(req, res);
    expect(mocks.voidPayment).toHaveBeenCalledWith("P001", "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
