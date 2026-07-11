import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-payment.service.js", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchasePaymentService from "../../../services/admin/purchase-payment.service.js";
import { ok } from "../../../shared/response.js";
import {
  list,
  getDetail,
  create,
  approve,
  voidPayment,
} from "../../../controllers/admin/purchase-payment.controller.js";

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

describe("purchase-payment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("应返回采购付款列表", async () => {
      (purchasePaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchasePaymentService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
        supplierId: undefined,
        paymentType: undefined,
        status: undefined,
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });

    it("应传递筛选参数", async () => {
      (purchasePaymentService.list as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          supplier_id: "3",
          payment_type: "BANK",
          status: "APPROVED",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
        },
      });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchasePaymentService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        tenantId: "t1",
        supplierId: 3,
        paymentType: "BANK",
        status: "APPROVED",
        dateStart: "2026-01-01",
        dateEnd: "2026-12-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchasePaymentService.list as any).mockRejectedValue(new Error("数据库错误"));
      const req = mockReq();
      const res = mockRes();
      await expect(list(req as any, res as any)).rejects.toThrow("数据库错误");
      expect(purchasePaymentService.list).toHaveBeenCalled();
    });
  });

  describe("getDetail", () => {
    it("应返回采购付款详情", async () => {
      (purchasePaymentService.getDetail as any).mockResolvedValue({ paymentNo: "PP001" });
      const req = mockReq({ params: { paymentNo: "PP001" } });
      const res = mockRes();
      await getDetail(req as any, res as any);
      expect(purchasePaymentService.getDetail).toHaveBeenCalledWith("PP001", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchasePaymentService.getDetail as any).mockRejectedValue(new Error("单据不存在"));
      const req = mockReq({ params: { paymentNo: "PP999" } });
      const res = mockRes();
      await expect(getDetail(req as any, res as any)).rejects.toThrow("单据不存在");
      expect(purchasePaymentService.getDetail).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("应创建采购付款单", async () => {
      (purchasePaymentService.create as any).mockResolvedValue({ paymentNo: "PP001" });
      const req = mockReq({
        body: {
          supplierId: 1,
          paymentType: "BANK",
          amount: 10000,
          remark: "测试付款",
        },
      });
      const res = mockRes();
      await create(req as any, res as any);
      expect(purchasePaymentService.create).toHaveBeenCalledWith(
        req.body,
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchasePaymentService.create as any).mockRejectedValue(new Error("创建失败"));
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(create(req as any, res as any)).rejects.toThrow("创建失败");
      expect(purchasePaymentService.create).toHaveBeenCalled();
    });
  });

  describe("approve", () => {
    it("应审批采购付款单", async () => {
      (purchasePaymentService.approve as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { paymentNo: "PP001" } });
      const res = mockRes();
      await approve(req as any, res as any);
      expect(purchasePaymentService.approve).toHaveBeenCalledWith(
        "PP001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchasePaymentService.approve as any).mockRejectedValue(new Error("审批失败"));
      const req = mockReq({ params: { paymentNo: "PP001" } });
      const res = mockRes();
      await expect(approve(req as any, res as any)).rejects.toThrow("审批失败");
      expect(purchasePaymentService.approve).toHaveBeenCalled();
    });
  });

  describe("voidPayment", () => {
    it("应作废采购付款单", async () => {
      (purchasePaymentService.voidPayment as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { paymentNo: "PP001" } });
      const res = mockRes();
      await voidPayment(req as any, res as any);
      expect(purchasePaymentService.voidPayment).toHaveBeenCalledWith(
        "PP001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchasePaymentService.voidPayment as any).mockRejectedValue(new Error("作废失败"));
      const req = mockReq({ params: { paymentNo: "PP001" } });
      const res = mockRes();
      await expect(voidPayment(req as any, res as any)).rejects.toThrow("作废失败");
      expect(purchasePaymentService.voidPayment).toHaveBeenCalled();
    });
  });
});
