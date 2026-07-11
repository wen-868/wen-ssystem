import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/aftersale.service.js", () => ({
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

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as aftersaleService from "../../services/admin/aftersale.service.js";
import { ok, fail } from "../../shared/response.js";
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
} from "../../controllers/aftersale.controller.js";

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

  describe("小程序端", () => {
    it("miniappCreateAftersale - 应创建售后单", async () => {
      (aftersaleService.createAftersale as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { orderNo: "O001", aftersaleType: "REFUND_ONLY", reason: "测试" } });
      const res = mockRes();
      await miniappCreateAftersale(req as any, res as any);
      expect(aftersaleService.createAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappListMyAftersales - 应返回我的售后列表", async () => {
      (aftersaleService.listMyAftersales as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await miniappListMyAftersales(req as any, res as any);
      expect(aftersaleService.listMyAftersales).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappGetAftersaleDetail - 应返回售后详情", async () => {
      (aftersaleService.getAftersaleDetail as any).mockResolvedValue({
        id: 1,
        items: JSON.stringify([{ skuId: 1 }]),
        images: JSON.stringify(["img1.jpg"]),
        inspect_images: JSON.stringify([]),
        aftersale_type: "REFUND_ONLY",
        status: "PENDING",
        refund_amount: 100,
      });
      const req = mockReq({ params: { aftersaleNo: "AS001" } });
      const res = mockRes();
      await miniappGetAftersaleDetail(req as any, res as any);
      expect(aftersaleService.getAftersaleDetail).toHaveBeenCalledWith("AS001", 1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("miniappCancelAftersale - 应取消售后", async () => {
      (aftersaleService.cancelAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AS001" } });
      const res = mockRes();
      await miniappCancelAftersale(req as any, res as any);
      expect(aftersaleService.cancelAftersale).toHaveBeenCalledWith("AS001", 1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("miniappSubmitReturnLogistics - 应提交退货物流", async () => {
      (aftersaleService.submitReturnLogistics as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AS001" }, body: { expressCompany: "顺丰", expressNo: "SF123" } });
      const res = mockRes();
      await miniappSubmitReturnLogistics(req as any, res as any);
      expect(aftersaleService.submitReturnLogistics).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("miniappRateAftersale - 应评价售后", async () => {
      (aftersaleService.rateAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { aftersaleNo: "AS001" }, body: { rating: 5, comment: "很好" } });
      const res = mockRes();
      await miniappRateAftersale(req as any, res as any);
      expect(aftersaleService.rateAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("管理端", () => {
    it("adminListAftersales - 应返回售后列表", async () => {
      (aftersaleService.listAftersales as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await adminListAftersales(req as any, res as any);
      expect(aftersaleService.listAftersales).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetAftersaleDetail - 应返回售后详情", async () => {
      (aftersaleService.getAftersaleDetailById as any).mockResolvedValue({
        id: 1,
        items: JSON.stringify([{ skuId: 1 }]),
        images: JSON.stringify(["img1.jpg"]),
        inspect_images: JSON.stringify([]),
        aftersale_type: "REFUND_ONLY",
        status: "PENDING",
        refund_amount: 100,
      });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await adminGetAftersaleDetail(req as any, res as any);
      expect(aftersaleService.getAftersaleDetailById).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("adminApproveAftersale - 应审核通过售后", async () => {
      (aftersaleService.approveAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" }, body: { processRemark: "同意", version: 1 } });
      const res = mockRes();
      await adminApproveAftersale(req as any, res as any);
      expect(aftersaleService.approveAftersale).toHaveBeenCalledWith(1, "t1", 1, "同意", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("adminRejectAftersale - 应拒绝售后", async () => {
      (aftersaleService.rejectAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" }, body: { processRemark: "拒绝", version: 1 } });
      const res = mockRes();
      await adminRejectAftersale(req as any, res as any);
      expect(aftersaleService.rejectAftersale).toHaveBeenCalledWith(1, "t1", 1, "拒绝", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("adminConfirmReceipt - 应确认收货", async () => {
      (aftersaleService.confirmReceipt as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await adminConfirmReceipt(req as any, res as any);
      expect(aftersaleService.confirmReceipt).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("adminInspectAftersale - 应验收入库", async () => {
      (aftersaleService.inspectAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" }, body: { inspectResult: "PASS" } });
      const res = mockRes();
      await adminInspectAftersale(req as any, res as any);
      expect(aftersaleService.inspectAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminCompleteAftersale - 应完成售后", async () => {
      (aftersaleService.completeAftersale as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" }, body: { remark: "完成" } });
      const res = mockRes();
      await adminCompleteAftersale(req as any, res as any);
      expect(aftersaleService.completeAftersale).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("adminGetStatistics - 应返回售后统计", async () => {
      (aftersaleService.getAftersaleStatistics as any).mockResolvedValue({
        typeStats: [],
        statusStats: [],
        avgProcessingHours: 0,
        avgSatisfaction: 0,
        overdueRate: 0,
      });
      const req = mockReq();
      const res = mockRes();
      await adminGetStatistics(req as any, res as any);
      expect(aftersaleService.getAftersaleStatistics).toHaveBeenCalledWith("t1", undefined);
      expect(ok).toHaveBeenCalled();
    });
  });
});
