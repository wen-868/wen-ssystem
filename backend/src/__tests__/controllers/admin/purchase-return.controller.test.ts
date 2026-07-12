import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-return.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidReturn: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseReturnService from "../../../services/admin/purchase-return.service";
import { ok } from "../../../shared/response";
import {
  list,
  getDetail,
  create,
  approve,
  voidReturn,
} from "../../../controllers/admin/purchase-return.controller";

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

describe("purchase-return.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("应返回采购退货列表", async () => {
      (purchaseReturnService.list as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchaseReturnService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
        supplierId: undefined,
        returnStatus: undefined,
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });

    it("应传递筛选参数", async () => {
      (purchaseReturnService.list as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          supplier_id: "3",
          return_status: "APPROVED",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
        },
      });
      const res = mockRes();
      await list(req as any, res as any);
      expect(purchaseReturnService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        tenantId: "t1",
        supplierId: 3,
        returnStatus: "APPROVED",
        dateStart: "2026-01-01",
        dateEnd: "2026-12-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseReturnService.list as any).mockRejectedValue(new Error("数据库错误"));
      const req = mockReq();
      const res = mockRes();
      await expect(list(req as any, res as any)).rejects.toThrow("数据库错误");
      expect(purchaseReturnService.list).toHaveBeenCalled();
    });
  });

  describe("getDetail", () => {
    it("应返回采购退货详情", async () => {
      (purchaseReturnService.getDetail as any).mockResolvedValue({ returnNo: "PR001" });
      const req = mockReq({ params: { returnNo: "PR001" } });
      const res = mockRes();
      await getDetail(req as any, res as any);
      expect(purchaseReturnService.getDetail).toHaveBeenCalledWith("PR001", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseReturnService.getDetail as any).mockRejectedValue(new Error("单据不存在"));
      const req = mockReq({ params: { returnNo: "PR999" } });
      const res = mockRes();
      await expect(getDetail(req as any, res as any)).rejects.toThrow("单据不存在");
      expect(purchaseReturnService.getDetail).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("应创建采购退货单", async () => {
      (purchaseReturnService.create as any).mockResolvedValue({ returnNo: "PR001" });
      const req = mockReq({
        body: {
          supplierId: 1,
          warehouseId: 1,
          items: [{ productId: 1, quantity: 10 }],
          remark: "测试退货",
        },
      });
      const res = mockRes();
      await create(req as any, res as any);
      expect(purchaseReturnService.create).toHaveBeenCalledWith(
        req.body,
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseReturnService.create as any).mockRejectedValue(new Error("创建失败"));
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(create(req as any, res as any)).rejects.toThrow("创建失败");
      expect(purchaseReturnService.create).toHaveBeenCalled();
    });
  });

  describe("approve", () => {
    it("应审批采购退货单", async () => {
      (purchaseReturnService.approve as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { returnNo: "PR001" } });
      const res = mockRes();
      await approve(req as any, res as any);
      expect(purchaseReturnService.approve).toHaveBeenCalledWith(
        "PR001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseReturnService.approve as any).mockRejectedValue(new Error("审批失败"));
      const req = mockReq({ params: { returnNo: "PR001" } });
      const res = mockRes();
      await expect(approve(req as any, res as any)).rejects.toThrow("审批失败");
      expect(purchaseReturnService.approve).toHaveBeenCalled();
    });
  });

  describe("voidReturn", () => {
    it("应作废采购退货单", async () => {
      (purchaseReturnService.voidReturn as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { returnNo: "PR001" } });
      const res = mockRes();
      await voidReturn(req as any, res as any);
      expect(purchaseReturnService.voidReturn).toHaveBeenCalledWith(
        "PR001",
        "t1",
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("service 抛错应抛出异常", async () => {
      (purchaseReturnService.voidReturn as any).mockRejectedValue(new Error("作废失败"));
      const req = mockReq({ params: { returnNo: "PR001" } });
      const res = mockRes();
      await expect(voidReturn(req as any, res as any)).rejects.toThrow("作废失败");
      expect(purchaseReturnService.voidReturn).toHaveBeenCalled();
    });
  });
});
