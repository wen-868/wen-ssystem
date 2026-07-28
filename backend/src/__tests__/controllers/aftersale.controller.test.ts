import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/aftersale.service", () => ({
  createAftersale: vi.fn(),
  listMyAftersales: vi.fn(),
  getAftersaleDetail: vi.fn(),
  cancelAftersale: vi.fn(),
  submitReturnLogistics: vi.fn(),
  rateAftersale: vi.fn(),
  listAftersales: vi.fn(),
  getAftersaleDetailById: vi.fn(),
  approveAftersale: vi.fn(),
  rejectAftersale: vi.fn(),
  confirmReceipt: vi.fn(),
  inspectAftersale: vi.fn(),
  completeAftersale: vi.fn(),
  getAftersaleStatistics: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as aftersaleService from "@services/admin/aftersale.service";
import { ok } from "@shared/response";
import {
  miniappCreateAftersale,
  miniappListMyAftersales,
  miniappGetAftersaleDetail,
  miniappCancelAftersale,
  miniappSubmitReturnLogistics,
  miniappRateAftersale,
  adminListAftersales,
  adminGetAftersaleDetail,
  adminApproveAftersale,
  adminRejectAftersale,
  adminConfirmReceipt,
  adminInspectAftersale,
  adminCompleteAftersale,
  adminGetStatistics,
} from "@controllers/admin/aftersale.controller";

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

describe("aftersale.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("miniapp endpoints", () => {
    it("miniappCreateAftersale - 应创建售后单", async () => {
      (aftersaleService.createAftersale as any).mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: { orderNo: "ORD001", aftersaleType: "REFUND_ONLY" },
      });
      const res = mockRes();
      await miniappCreateAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.createAftersale).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: "t1",
        customerId: 1,
        orderNo: "ORD001",
        aftersaleType: "REFUND_ONLY",
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("miniappListMyAftersales - 应返回我的售后列表", async () => {
      (aftersaleService.listMyAftersales as any).mockResolvedValue({ total: 1, records: [{ aftersaleType: "REFUND_ONLY", status: "PENDING" }] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await miniappListMyAftersales(req as any, res as any, vi.fn());
      expect(aftersaleService.listMyAftersales).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappGetAftersaleDetail - 应返回售后详情", async () => {
      (aftersaleService.getAftersaleDetail as any).mockResolvedValue({ items: "[]", images: "[]", inspect_images: "[]", aftersale_type: "REFUND_ONLY", status: "PENDING" });
      const req = mockReq({ params: { aftersaleNo: "AF001" } });
      const res = mockRes();
      await miniappGetAftersaleDetail(req as any, res as any, vi.fn());
      expect(aftersaleService.getAftersaleDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappCancelAftersale - 应取消售后", async () => {
      (aftersaleService.cancelAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AF001" } });
      const res = mockRes();
      await miniappCancelAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.cancelAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappSubmitReturnLogistics - 应提交退货物流", async () => {
      (aftersaleService.submitReturnLogistics as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AF001" }, body: { logisticsNo: "SF123" } });
      const res = mockRes();
      await miniappSubmitReturnLogistics(req as any, res as any, vi.fn());
      expect(aftersaleService.submitReturnLogistics).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappRateAftersale - 应评价售后", async () => {
      (aftersaleService.rateAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AF001" }, body: { rating: 5 } });
      const res = mockRes();
      await miniappRateAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.rateAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("admin endpoints", () => {
    it("adminListAftersales - 应返回售后列表", async () => {
      (aftersaleService.listAftersales as any).mockResolvedValue({ total: 1, records: [{ aftersaleType: "REFUND_ONLY", status: "PENDING" }] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await adminListAftersales(req as any, res as any, vi.fn());
      expect(aftersaleService.listAftersales).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetAftersaleDetail - 应返回售后详情", async () => {
      (aftersaleService.getAftersaleDetailById as any).mockResolvedValue({ items: "[]", images: "[]", inspect_images: "[]" });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminGetAftersaleDetail(req as any, res as any, vi.fn());
      expect(aftersaleService.getAftersaleDetailById).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminApproveAftersale - 应审核通过", async () => {
      (aftersaleService.approveAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { processRemark: "同意" } });
      const res = mockRes();
      await adminApproveAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.approveAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminRejectAftersale - 应拒绝售后", async () => {
      (aftersaleService.rejectAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { processRemark: "拒绝原因" } });
      const res = mockRes();
      await adminRejectAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.rejectAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminConfirmReceipt - 应确认收货", async () => {
      (aftersaleService.confirmReceipt as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminConfirmReceipt(req as any, res as any, vi.fn());
      expect(aftersaleService.confirmReceipt).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminInspectAftersale - 应验货", async () => {
      (aftersaleService.inspectAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { result: "PASS" } });
      const res = mockRes();
      await adminInspectAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.inspectAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminCompleteAftersale - 应完成售后", async () => {
      (aftersaleService.completeAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { refundAmount: 100 } });
      const res = mockRes();
      await adminCompleteAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.completeAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetStatistics - 应返回统计数据", async () => {
      (aftersaleService.getAftersaleStatistics as any).mockResolvedValue({ typeStats: [], statusStats: [], avgProcessingHours: 0, avgSatisfaction: 0, overdueRate: 0 });
      const req = mockReq();
      const res = mockRes();
      await adminGetStatistics(req as any, res as any, vi.fn());
      expect(aftersaleService.getAftersaleStatistics).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  // ==================== 分支覆盖率补充测试 ====================
  describe("分支覆盖率补充", () => {
    it("miniappCreateAftersale - user无id但header有x-customer-id时使用header值", async () => {
      (aftersaleService.createAftersale as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ user: {}, headers: { "x-customer-id": "99" }, body: { orderNo: "ORD001" } });
      const res = mockRes();
      await miniappCreateAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.createAftersale).toHaveBeenCalledWith(expect.objectContaining({ customerId: 99 }));
    });

    it("miniappCreateAftersale - user无id且header无x-customer-id时使用默认值1", async () => {
      (aftersaleService.createAftersale as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ user: {}, headers: {}, body: { orderNo: "ORD001" } });
      const res = mockRes();
      await miniappCreateAftersale(req as any, res as any, vi.fn());
      expect(aftersaleService.createAftersale).toHaveBeenCalledWith(expect.objectContaining({ customerId: 1 }));
    });

    it("miniappListMyAftersales - 不传page/pageSize时使用默认值", async () => {
      (aftersaleService.listMyAftersales as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await miniappListMyAftersales(req as any, res as any, vi.fn());
      expect(aftersaleService.listMyAftersales).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20, status: "" }));
    });

    it("miniappListMyAftersales - 传status参数且未知类型/状态时使用原值", async () => {
      (aftersaleService.listMyAftersales as any).mockResolvedValue({
        total: 1, records: [{ aftersaleType: "UNKNOWN_TYPE", status: "UNKNOWN_STATUS", refund_amount: "0" }]
      });
      const req = mockReq({ query: { status: "PENDING" } });
      const res = mockRes();
      await miniappListMyAftersales(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("miniappGetAftersaleDetail - items为非string类型(数组)时直接使用", async () => {
      (aftersaleService.getAftersaleDetail as any).mockResolvedValue({
        items: [{ skuId: 1 }], images: [{ url: "img" }], inspect_images: [{ url: "inspect" }],
        aftersale_type: "REFUND_ONLY", status: "PENDING", refund_amount: "100"
      });
      const req = mockReq({ params: { aftersaleNo: "AF001" } });
      const res = mockRes();
      await miniappGetAftersaleDetail(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("miniappGetAftersaleDetail - 未知aftersale_type和status时使用原值", async () => {
      (aftersaleService.getAftersaleDetail as any).mockResolvedValue({
        items: "[]", images: "[]", inspect_images: "[]",
        aftersale_type: "UNKNOWN", status: "UNKNOWN", refund_amount: "0"
      });
      const req = mockReq({ params: { aftersaleNo: "AF001" } });
      const res = mockRes();
      await miniappGetAftersaleDetail(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("adminListAftersales - 不传page/pageSize且传storeId/status/keyword时正确解析", async () => {
      (aftersaleService.listAftersales as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { storeId: "5", status: "PENDING", keyword: "test", startDate: "2026-01-01", endDate: "2026-12-31" } });
      const res = mockRes();
      await adminListAftersales(req as any, res as any, vi.fn());
      expect(aftersaleService.listAftersales).toHaveBeenCalledWith(expect.objectContaining({
        page: 1, pageSize: 20, storeId: 5, status: "PENDING", keyword: "test"
      }));
    });

    it("adminListAftersales - 未知aftersaleType和status时使用原值", async () => {
      (aftersaleService.listAftersales as any).mockResolvedValue({
        total: 1, records: [{ aftersaleType: "UNKNOWN", status: "UNKNOWN", refund_amount: "0" }]
      });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await adminListAftersales(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetAftersaleDetail - items为非string类型时直接使用", async () => {
      (aftersaleService.getAftersaleDetailById as any).mockResolvedValue({
        items: [{ skuId: 1 }], images: [{ url: "img" }], inspect_images: [],
        aftersale_type: "EXCHANGE", status: "COMPLETED", refund_amount: "50"
      });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminGetAftersaleDetail(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetStatistics - 传storeId且未知type/status时使用原值", async () => {
      (aftersaleService.getAftersaleStatistics as any).mockResolvedValue({
        typeStats: [{ type: "UNKNOWN", count: 1 }],
        statusStats: [{ status: "UNKNOWN", count: 1 }],
        avgProcessingHours: 0, avgSatisfaction: 0, overdueRate: 0
      });
      const req = mockReq({ query: { storeId: "3" } });
      const res = mockRes();
      await adminGetStatistics(req as any, res as any, vi.fn());
      expect(aftersaleService.getAftersaleStatistics).toHaveBeenCalledWith("t1", 3);
      expect(ok).toHaveBeenCalled();
    });
  });
});