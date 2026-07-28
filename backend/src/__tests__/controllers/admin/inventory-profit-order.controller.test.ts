/**
 * 管理端报溢单 controller 单元测试
 * 被测文件：src/controllers/admin/inventory-profit-order.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listProfitOrders: vi.fn(),
  getProfitOrderDetail: vi.fn(),
  createProfitOrder: vi.fn(),
  approveProfitOrder: vi.fn(),
  rejectProfitOrder: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/inventory-profit-order.service", () => ({
  listProfitOrders: mocks.listProfitOrders,
  getProfitOrderDetail: mocks.getProfitOrderDetail,
  createProfitOrder: mocks.createProfitOrder,
  approveProfitOrder: mocks.approveProfitOrder,
  rejectProfitOrder: mocks.rejectProfitOrder,
}));

import {
  listProfitOrders,
  getProfitOrderDetail,
  createProfitOrder,
  approveProfitOrder,
  rejectProfitOrder,
} from "../../../controllers/admin/inventory-profit-order.controller";

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

describe("admin inventory-profit-order.controller", () => {
  describe("listProfitOrders", () => {
    it("默认分页参数", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        storeId: undefined,
        status: undefined,
        profitType: undefined,
        dateStart: undefined,
        dateEnd: undefined,
        keyword: undefined,
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ list: [], total: 0 });
    });

    it("自定义分页参数", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { page: "2", pageSize: "50" } });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        pageSize: 50,
      }));
    });

    it("传入 storeId 时转换为数字", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { storeId: "3" } });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 3,
      }));
    });

    it("不传 storeId 时为 undefined", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        storeId: undefined,
      }));
    });

    it("传入 status", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { status: "APPROVED" } });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        status: "APPROVED",
      }));
    });

    it("传入 profitType", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { profitType: "OVERFLOW" } });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        profitType: "OVERFLOW",
      }));
    });

    it("传入日期范围和 keyword", async () => {
      mocks.listProfitOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({
        query: {
          dateStart: "2026-01-01",
          dateEnd: "2026-01-31",
          keyword: "盘盈",
        },
      });
      const res = mockRes();
      await listProfitOrders(req, res, vi.fn());
      expect(mocks.listProfitOrders).toHaveBeenCalledWith(expect.objectContaining({
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
        keyword: "盘盈",
      }));
    });
  });

  describe("getProfitOrderDetail", () => {
    it("获取报溢单详情", async () => {
      mocks.getProfitOrderDetail.mockResolvedValue({ id: 1, profitNo: "BY20260101001" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getProfitOrderDetail(req, res, vi.fn());
      expect(mocks.getProfitOrderDetail).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, profitNo: "BY20260101001" });
    });
  });

  describe("createProfitOrder", () => {
    it("创建报溢单成功", async () => {
      mocks.createProfitOrder.mockResolvedValue({ id: 1, profitNo: "BY20260101001" });
      const req = mockReq({
        body: {
          storeId: "2",
          storeName: "二号店",
          profitType: "OVERFLOW",
          reason: "盘点溢余",
          remark: "系统误差",
          operatorName: "王盘点",
          items: [{ skuId: 2, quantity: 3, costPrice: 30 }],
        },
      });
      const res = mockRes();
      await createProfitOrder(req, res, vi.fn());
      expect(mocks.createProfitOrder).toHaveBeenCalledWith({
        storeId: 2,
        storeName: "二号店",
        profitType: "OVERFLOW",
        reason: "盘点溢余",
        remark: "系统误差",
        operatorId: 1,
        operatorName: "王盘点",
        items: [{ skuId: 2, quantity: 3, costPrice: 30 }],
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, profitNo: "BY20260101001" });
    });

    it("不传 profitType 时默认为 NORMAL", async () => {
      mocks.createProfitOrder.mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: { storeId: "1", storeName: "旗舰店", items: [] },
      });
      const res = mockRes();
      await createProfitOrder(req, res, vi.fn());
      expect(mocks.createProfitOrder).toHaveBeenCalledWith(expect.objectContaining({
        profitType: "NORMAL",
      }));
    });

    it("不传 items 时默认为空数组", async () => {
      mocks.createProfitOrder.mockResolvedValue({ id: 3 });
      const req = mockReq({
        body: { storeId: "1", storeName: "旗舰店" },
      });
      const res = mockRes();
      await createProfitOrder(req, res, vi.fn());
      expect(mocks.createProfitOrder).toHaveBeenCalledWith(expect.objectContaining({
        items: [],
      }));
    });

    it("传递 operatorId 来自 req.user.id", async () => {
      mocks.createProfitOrder.mockResolvedValue({ id: 4 });
      const req = mockReq({
        user: { id: 88, username: "supervisor" },
        body: { storeId: "1", storeName: "旗舰店", items: [] },
      });
      const res = mockRes();
      await createProfitOrder(req, res, vi.fn());
      expect(mocks.createProfitOrder).toHaveBeenCalledWith(expect.objectContaining({
        operatorId: 88,
      }));
    });
  });

  describe("approveProfitOrder", () => {
    it("审核通过报溢单", async () => {
      mocks.approveProfitOrder.mockResolvedValue({ success: true });
      const req = mockReq({
        params: { id: "1" },
        body: { auditorName: "赵主管" },
      });
      const res = mockRes();
      await approveProfitOrder(req, res, vi.fn());
      expect(mocks.approveProfitOrder).toHaveBeenCalledWith(1, {
        auditorId: 1,
        auditorName: "赵主管",
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("rejectProfitOrder", () => {
    it("审核驳回报溢单", async () => {
      mocks.rejectProfitOrder.mockResolvedValue({ success: true });
      const req = mockReq({
        params: { id: "1" },
        body: { auditorName: "赵主管", rejectReason: "原因不明" },
      });
      const res = mockRes();
      await rejectProfitOrder(req, res, vi.fn());
      expect(mocks.rejectProfitOrder).toHaveBeenCalledWith(1, {
        auditorId: 1,
        auditorName: "赵主管",
        rejectReason: "原因不明",
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });
});
