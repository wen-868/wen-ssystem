import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/customer-payment.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerPaymentService from "../../../services/admin/customer-payment.service";
import { ok } from "../../../shared/response";
import {
  list,
  getDetail,
  create,
  voidPayment,
} from "../../../controllers/admin/customer-payment.controller";

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

describe("customer-payment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("应返回客户付款列表", async () => {
      (customerPaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(customerPaymentService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
        customerId: undefined,
        status: undefined,
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });

    it("应支持按客户、状态、日期筛选", async () => {
      (customerPaymentService.list as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({
        query: {
          customer_id: "5",
          status: "SUCCESS",
          start_date: "2026-01-01",
          end_date: "2026-01-31",
          page: "2",
          pageSize: "10",
        },
      });
      const res = mockRes();
      await list(req as any, res as any);
      expect(customerPaymentService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        tenantId: "t1",
        customerId: 5,
        status: "SUCCESS",
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerPaymentService.list as any).mockRejectedValue(new Error("数据库错误"));
      const req = mockReq();
      const res = mockRes();
      await expect(list(req as any, res as any)).rejects.toThrow("数据库错误");
    });
  });

  describe("getDetail", () => {
    it("应返回付款单详情", async () => {
      (customerPaymentService.getDetail as any).mockResolvedValue({ receiptNo: "RCP001" });
      const req = mockReq({ params: { receiptNo: "RCP001" } });
      const res = mockRes();
      await getDetail(req as any, res as any);
      expect(customerPaymentService.getDetail).toHaveBeenCalledWith("RCP001", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerPaymentService.getDetail as any).mockRejectedValue(new Error("付款单不存在"));
      const req = mockReq({ params: { receiptNo: "RCP999" } });
      const res = mockRes();
      await expect(getDetail(req as any, res as any)).rejects.toThrow("付款单不存在");
    });
  });

  describe("create", () => {
    it("应创建客户付款单", async () => {
      const body = { customerId: 1, amount: 100, paymentMethod: "CASH" };
      (customerPaymentService.create as any).mockResolvedValue({ receiptNo: "RCP001" });
      const req = mockReq({ body });
      const res = mockRes();
      await create(req as any, res as any);
      expect(customerPaymentService.create).toHaveBeenCalledWith(body, "t1", 1, "admin");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      const body = { customerId: 1, amount: 100 };
      (customerPaymentService.create as any).mockRejectedValue(new Error("客户不存在"));
      const req = mockReq({ body });
      const res = mockRes();
      await expect(create(req as any, res as any)).rejects.toThrow("客户不存在");
    });
  });

  describe("voidPayment", () => {
    it("应作废付款单", async () => {
      (customerPaymentService.voidPayment as any).mockResolvedValue({ receiptNo: "RCP001", status: "VOIDED" });
      const req = mockReq({ params: { receiptNo: "RCP001" } });
      const res = mockRes();
      await voidPayment(req as any, res as any);
      expect(customerPaymentService.voidPayment).toHaveBeenCalledWith("RCP001", "t1", 1, "admin");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      (customerPaymentService.voidPayment as any).mockRejectedValue(new Error("付款单已作废"));
      const req = mockReq({ params: { receiptNo: "RCP001" } });
      const res = mockRes();
      await expect(voidPayment(req as any, res as any)).rejects.toThrow("付款单已作废");
    });
  });
});
