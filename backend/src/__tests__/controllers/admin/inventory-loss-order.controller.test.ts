/**
 * 管理端报损单 controller 单元测试
 * 被测文件：src/controllers/admin/inventory-loss-order.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listLossOrders: vi.fn(),
  getLossOrderDetail: vi.fn(),
  createLossOrder: vi.fn(),
  approveLossOrder: vi.fn(),
  rejectLossOrder: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/inventory-loss-order.service", () => ({
  listLossOrders: mocks.listLossOrders,
  getLossOrderDetail: mocks.getLossOrderDetail,
  createLossOrder: mocks.createLossOrder,
  approveLossOrder: mocks.approveLossOrder,
  rejectLossOrder: mocks.rejectLossOrder,
}));

import {
  listLossOrders,
  getLossOrderDetail,
  createLossOrder,
  approveLossOrder,
  rejectLossOrder,
} from "../../../controllers/admin/inventory-loss-order.controller";

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

describe("admin inventory-loss-order.controller", () => {
  describe("listLossOrders", () => {
    it("默认分页参数", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        storeId: undefined,
        status: undefined,
        lossType: undefined,
        dateStart: undefined,
        dateEnd: undefined,
        keyword: undefined,
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ list: [], total: 0 });
    });

    it("自定义分页参数", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { page: "2", pageSize: "50" } });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        pageSize: 50,
      }));
    });

    it("传入 storeId 时转换为数字", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { storeId: "5" } });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 5,
      }));
    });

    it("不传 storeId 时为 undefined", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        storeId: undefined,
      }));
    });

    it("传入 status", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { status: "PENDING" } });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        status: "PENDING",
      }));
    });

    it("传入 lossType", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { lossType: "DAMAGE" } });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        lossType: "DAMAGE",
      }));
    });

    it("传入日期范围和 keyword", async () => {
      mocks.listLossOrders.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({
        query: {
          dateStart: "2026-01-01",
          dateEnd: "2026-01-31",
          keyword: "破损",
        },
      });
      const res = mockRes();
      await listLossOrders(req, res);
      expect(mocks.listLossOrders).toHaveBeenCalledWith(expect.objectContaining({
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
        keyword: "破损",
      }));
    });
  });

  describe("getLossOrderDetail", () => {
    it("获取报损单详情", async () => {
      mocks.getLossOrderDetail.mockResolvedValue({ id: 1, lossNo: "BS20260101001" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getLossOrderDetail(req, res);
      expect(mocks.getLossOrderDetail).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, lossNo: "BS20260101001" });
    });
  });

  describe("createLossOrder", () => {
    it("创建报损单成功", async () => {
      mocks.createLossOrder.mockResolvedValue({ id: 1, lossNo: "BS20260101001" });
      const req = mockReq({
        body: {
          storeId: "1",
          storeName: "旗舰店",
          lossType: "DAMAGE",
          reason: "运输破损",
          remark: "外包装破损",
          operatorName: "张三",
          items: [{ skuId: 1, quantity: 2, costPrice: 50 }],
        },
      });
      const res = mockRes();
      await createLossOrder(req, res);
      expect(mocks.createLossOrder).toHaveBeenCalledWith({
        storeId: 1,
        storeName: "旗舰店",
        lossType: "DAMAGE",
        reason: "运输破损",
        remark: "外包装破损",
        operatorId: 1,
        operatorName: "张三",
        items: [{ skuId: 1, quantity: 2, costPrice: 50 }],
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, lossNo: "BS20260101001" });
    });

    it("不传 lossType 时默认为 NORMAL", async () => {
      mocks.createLossOrder.mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: { storeId: "1", storeName: "旗舰店", items: [] },
      });
      const res = mockRes();
      await createLossOrder(req, res);
      expect(mocks.createLossOrder).toHaveBeenCalledWith(expect.objectContaining({
        lossType: "NORMAL",
      }));
    });

    it("不传 items 时默认为空数组", async () => {
      mocks.createLossOrder.mockResolvedValue({ id: 3 });
      const req = mockReq({
        body: { storeId: "1", storeName: "旗舰店" },
      });
      const res = mockRes();
      await createLossOrder(req, res);
      expect(mocks.createLossOrder).toHaveBeenCalledWith(expect.objectContaining({
        items: [],
      }));
    });

    it("传递 operatorId 来自 req.user.id", async () => {
      mocks.createLossOrder.mockResolvedValue({ id: 4 });
      const req = mockReq({
        user: { id: 99, username: "manager" },
        body: { storeId: "1", storeName: "旗舰店", items: [] },
      });
      const res = mockRes();
      await createLossOrder(req, res);
      expect(mocks.createLossOrder).toHaveBeenCalledWith(expect.objectContaining({
        operatorId: 99,
      }));
    });
  });

  describe("approveLossOrder", () => {
    it("审核通过报损单", async () => {
      mocks.approveLossOrder.mockResolvedValue({ success: true });
      const req = mockReq({
        params: { id: "1" },
        body: { auditorName: "李经理" },
      });
      const res = mockRes();
      await approveLossOrder(req, res);
      expect(mocks.approveLossOrder).toHaveBeenCalledWith(1, {
        auditorId: 1,
        auditorName: "李经理",
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("rejectLossOrder", () => {
    it("审核驳回报损单", async () => {
      mocks.rejectLossOrder.mockResolvedValue({ success: true });
      const req = mockReq({
        params: { id: "1" },
        body: { auditorName: "李经理", rejectReason: "数量不符" },
      });
      const res = mockRes();
      await rejectLossOrder(req, res);
      expect(mocks.rejectLossOrder).toHaveBeenCalledWith(1, {
        auditorId: 1,
        auditorName: "李经理",
        rejectReason: "数量不符",
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });
});
