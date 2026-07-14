/**
 * 管理端调拨单V2 controller 单元测试
 * 被测文件：src/controllers/admin/transfer-order-v2.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  listTransferOrders: vi.fn(),
  getTransferOrderDetail: vi.fn(),
  createTransferOrder: vi.fn(),
  updateTransferOrder: vi.fn(),
  deleteTransferOrder: vi.fn(),
  submitTransferOrder: vi.fn(),
  approveTransferOrder: vi.fn(),
  rejectTransferOrder: vi.fn(),
  confirmTransferOut: vi.fn(),
  confirmTransferIn: vi.fn(),
  getTransferStats: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/transfer-order.service", () => ({
  listTransferOrders: mocks.listTransferOrders,
  getTransferOrderDetail: mocks.getTransferOrderDetail,
  createTransferOrder: mocks.createTransferOrder,
  updateTransferOrder: mocks.updateTransferOrder,
  deleteTransferOrder: mocks.deleteTransferOrder,
  submitTransferOrder: mocks.submitTransferOrder,
  approveTransferOrder: mocks.approveTransferOrder,
  rejectTransferOrder: mocks.rejectTransferOrder,
  confirmTransferOut: mocks.confirmTransferOut,
  confirmTransferIn: mocks.confirmTransferIn,
  getTransferStats: mocks.getTransferStats,
}));

import {
  listTransferOrders,
  getTransferOrderDetail,
  createTransferOrder,
  updateTransferOrder,
  deleteTransferOrder,
  approveTransferOrder,
  rejectTransferOrder,
  confirmTransferOut,
  confirmTransferIn,
  getTransferStats,
} from "../../../controllers/admin/transfer-order-v2.controller";

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
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTransferOrders.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
  mocks.getTransferOrderDetail.mockResolvedValue({ id: 1, items: [] });
  mocks.createTransferOrder.mockResolvedValue({ id: 1, transferNo: "DB001" });
  mocks.updateTransferOrder.mockResolvedValue({ id: 1 });
  mocks.deleteTransferOrder.mockResolvedValue({ success: true });
  mocks.approveTransferOrder.mockResolvedValue({ id: 1 });
  mocks.rejectTransferOrder.mockResolvedValue({ id: 1 });
  mocks.confirmTransferOut.mockResolvedValue({ id: 1 });
  mocks.confirmTransferIn.mockResolvedValue({ id: 1 });
  mocks.getTransferStats.mockResolvedValue({ monthTotal: 10 });
});

describe("admin transfer-order-v2.controller", () => {
  describe("listTransferOrders", () => {
    it("默认分页参数", async () => {
      const req = mockReq();
      const res = mockRes();
      await listTransferOrders(req, res);
      expect(mocks.listTransferOrders).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        status: undefined,
        fromStoreId: undefined,
        toStoreId: undefined,
        storeId: undefined,
        dateStart: undefined,
        dateEnd: undefined,
        keyword: undefined,
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalled();
    });

    it("传入全部查询参数", async () => {
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          status: "PENDING",
          fromStoreId: "1",
          toStoreId: "2",
          storeId: "3",
          dateStart: "2026-01-01",
          dateEnd: "2026-12-31",
          keyword: "测试",
        },
      });
      const res = mockRes();
      await listTransferOrders(req, res);
      expect(mocks.listTransferOrders).toHaveBeenCalled();
      const arg = mocks.listTransferOrders.mock.calls[0][0];
      expect(arg.page).toBe(2);
      expect(arg.pageSize).toBe(10);
      expect(arg.status).toBe("PENDING");
      expect(arg.fromStoreId).toBe(1);
      expect(arg.toStoreId).toBe(2);
      expect(arg.storeId).toBe(3);
    });
  });

  describe("getTransferOrderDetail", () => {
    it("正确调用 service", async () => {
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getTransferOrderDetail(req, res);
      expect(mocks.getTransferOrderDetail).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("createTransferOrder", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        body: {
          fromStoreId: 1,
          fromStoreName: "总店",
          toStoreId: 2,
          toStoreName: "分店",
          expectedDate: "2026-07-20",
          remark: "测试",
          userName: "张三",
          items: [{ skuId: 1, skuName: "商品A", quantity: 10, unitPrice: 50 }],
        },
      });
      const res = mockRes();
      await createTransferOrder(req, res);
      expect(mocks.createTransferOrder).toHaveBeenCalled();
      const arg = mocks.createTransferOrder.mock.calls[0][0];
      expect(arg.fromStoreId).toBe(1);
      expect(arg.toStoreId).toBe(2);
      expect(arg.userId).toBe(1);
      expect(arg.items.length).toBe(1);
    });
  });

  describe("updateTransferOrder", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { expectedDate: "2026-07-20", remark: "更新备注", items: [] },
      });
      const res = mockRes();
      await updateTransferOrder(req, res);
      expect(mocks.updateTransferOrder).toHaveBeenCalledWith(1, "t1", {
        expectedDate: "2026-07-20",
        remark: "更新备注",
        items: [],
      });
    });
  });

  describe("deleteTransferOrder", () => {
    it("正确调用 service", async () => {
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteTransferOrder(req, res);
      expect(mocks.deleteTransferOrder).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("approveTransferOrder", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { approverName: "审核员" },
      });
      const res = mockRes();
      await approveTransferOrder(req, res);
      expect(mocks.approveTransferOrder).toHaveBeenCalledWith(1, "t1", {
        approverId: 1,
        approverName: "审核员",
      });
    });
  });

  describe("rejectTransferOrder", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { approverName: "审核员", rejectReason: "不对" },
      });
      const res = mockRes();
      await rejectTransferOrder(req, res);
      expect(mocks.rejectTransferOrder).toHaveBeenCalledWith(1, "t1", {
        approverId: 1,
        approverName: "审核员",
        rejectReason: "不对",
      });
    });
  });

  describe("confirmTransferOut", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { operatorName: "库管员" },
      });
      const res = mockRes();
      await confirmTransferOut(req, res);
      expect(mocks.confirmTransferOut).toHaveBeenCalledWith(1, "t1", {
        operatorId: 1,
        operatorName: "库管员",
      });
    });
  });

  describe("confirmTransferIn", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { operatorName: "库管员" },
      });
      const res = mockRes();
      await confirmTransferIn(req, res);
      expect(mocks.confirmTransferIn).toHaveBeenCalledWith(1, "t1", {
        operatorId: 1,
        operatorName: "库管员",
      });
    });
  });

  describe("getTransferStats", () => {
    it("正确调用 service", async () => {
      const req = mockReq();
      const res = mockRes();
      await getTransferStats(req, res);
      expect(mocks.getTransferStats).toHaveBeenCalledWith("t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });
});
