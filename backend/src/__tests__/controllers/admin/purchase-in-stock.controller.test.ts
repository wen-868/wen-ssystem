import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-in-stock.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidStock: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseInStockService from "../../../services/admin/purchase-in-stock.service";
import { ok } from "../../../shared/response";
import {
  list,
  getDetail,
  create,
  approve,
  voidStock,
} from "../../../controllers/admin/purchase-in-stock.controller";

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

describe("purchase-in-stock.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("应返回采购入库列表", async () => {
      (purchaseInStockService.list as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchaseInStockService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
        supplierId: undefined,
        stockStatus: undefined,
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });

    it("应传递筛选参数", async () => {
      (purchaseInStockService.list as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          supplier_id: "3",
          stock_status: "APPROVED",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
        },
      });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchaseInStockService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        tenantId: "t1",
        supplierId: 3,
        stockStatus: "APPROVED",
        dateStart: "2026-01-01",
        dateEnd: "2026-12-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseInStockService.list as any).mockRejectedValue(new Error("数据库错误"));
      const req = mockReq();
      const res = mockRes();
      await expect(list(req as any, res as any)).rejects.toThrow("数据库错误");
      expect(purchaseInStockService.list).toHaveBeenCalled();
    });
  });

  describe("getDetail", () => {
    it("应返回采购入库详情", async () => {
      (purchaseInStockService.getDetail as any).mockResolvedValue({ stockNo: "PI001" });
      const req = mockReq({ params: { stockNo: "PI001" } });
      const res = mockRes();
      await getDetail(req as any, res as any);
      expect(purchaseInStockService.getDetail).toHaveBeenCalledWith("PI001", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseInStockService.getDetail as any).mockRejectedValue(new Error("单据不存在"));
      const req = mockReq({ params: { stockNo: "PI999" } });
      const res = mockRes();
      await expect(getDetail(req as any, res as any)).rejects.toThrow("单据不存在");
      expect(purchaseInStockService.getDetail).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("应创建采购入库单", async () => {
      (purchaseInStockService.create as any).mockResolvedValue({ stockNo: "PI001" });
      const req = mockReq({
        body: {
          supplierId: 1,
          warehouseId: 1,
          items: [{ productId: 1, quantity: 10 }],
          remark: "测试入库",
        },
      });
      const res = mockRes();
      await create(req as any, res as any);
      expect(purchaseInStockService.create).toHaveBeenCalledWith(
        req.body,
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseInStockService.create as any).mockRejectedValue(new Error("创建失败"));
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(create(req as any, res as any)).rejects.toThrow("创建失败");
      expect(purchaseInStockService.create).toHaveBeenCalled();
    });
  });

  describe("approve", () => {
    it("应审批采购入库单", async () => {
      (purchaseInStockService.approve as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { stockNo: "PI001" } });
      const res = mockRes();
      await approve(req as any, res as any);
      expect(purchaseInStockService.approve).toHaveBeenCalledWith(
        "PI001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseInStockService.approve as any).mockRejectedValue(new Error("审批失败"));
      const req = mockReq({ params: { stockNo: "PI001" } });
      const res = mockRes();
      await expect(approve(req as any, res as any)).rejects.toThrow("审批失败");
      expect(purchaseInStockService.approve).toHaveBeenCalled();
    });
  });

  describe("voidStock", () => {
    it("应作废采购入库单", async () => {
      (purchaseInStockService.voidStock as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { stockNo: "PI001" } });
      const res = mockRes();
      await voidStock(req as any, res as any);
      expect(purchaseInStockService.voidStock).toHaveBeenCalledWith(
        "PI001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseInStockService.voidStock as any).mockRejectedValue(new Error("作废失败"));
      const req = mockReq({ params: { stockNo: "PI001" } });
      const res = mockRes();
      await expect(voidStock(req as any, res as any)).rejects.toThrow("作废失败");
      expect(purchaseInStockService.voidStock).toHaveBeenCalled();
    });
  });
});
