import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/stock-check.service", () => ({
  createCheck: vi.fn(),
  listChecks: vi.fn(),
  getStatistics: vi.fn(),
  getCheckDetail: vi.fn(),
  updateCheck: vi.fn(),
  startCheck: vi.fn(),
  completeCheck: vi.fn(),
  cancelCheck: vi.fn(),
  handleDiff: vi.fn(),
  listMyChecks: vi.fn(),
  getMyCheckDetail: vi.fn(),
  updateItemQty: vi.fn(),
  submitCheck: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as stockCheckService from "@services/admin/stock-check.service";
import { ok, fail } from "@shared/response";
import {
  adminStockCheck,
  storeStockCheck,
  create,
  getStatistics,
  list,
  getDetail,
  update,
  start,
  complete,
  cancel,
  handleDiff,
  getMyList,
  updateItem,
  submit,
} from "@controllers/admin/stock-check.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1 },
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

describe("stock-check.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("adminStockCheck", () => {
    it("create - 应创建盘点任务", async () => {
      (stockCheckService.createCheck as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { storeId: 1 } });
      const res = mockRes();
      await adminStockCheck.create(req as any, res as any);
      expect(stockCheckService.createCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("create - zod验证失败", async () => {
      const req = mockReq({ body: { storeId: 0 } });
      const res = mockRes();
      await expect(adminStockCheck.create(req as any, res as any)).rejects.toThrow();
    });

    it("list - 应返回盘点列表", async () => {
      (stockCheckService.listChecks as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await adminStockCheck.list(req as any, res as any);
      expect(stockCheckService.listChecks).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("statistics - 应返回统计数据", async () => {
      (stockCheckService.getStatistics as any).mockResolvedValue({ total: 0 });
      const req = mockReq();
      const res = mockRes();
      await adminStockCheck.statistics(req as any, res as any);
      expect(stockCheckService.getStatistics).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("detail - 应返回盘点详情", async () => {
      (stockCheckService.getCheckDetail as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminStockCheck.detail(req as any, res as any);
      expect(stockCheckService.getCheckDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("update - 应更新盘点", async () => {
      (stockCheckService.updateCheck as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { remark: "测试" } });
      const res = mockRes();
      await adminStockCheck.update(req as any, res as any);
      expect(stockCheckService.updateCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("start - 应开始盘点", async () => {
      (stockCheckService.startCheck as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminStockCheck.start(req as any, res as any);
      expect(stockCheckService.startCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("complete - 应完成盘点", async () => {
      (stockCheckService.completeCheck as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminStockCheck.complete(req as any, res as any);
      expect(stockCheckService.completeCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("cancel - 应取消盘点", async () => {
      (stockCheckService.cancelCheck as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await adminStockCheck.cancel(req as any, res as any);
      expect(stockCheckService.cancelCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("handleDiff - 应处理差异", async () => {
      (stockCheckService.handleDiff as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { itemId: 1 } });
      const res = mockRes();
      await adminStockCheck.handleDiff(req as any, res as any);
      expect(stockCheckService.handleDiff).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("storeStockCheck", () => {
    it("my - 应返回我的盘点列表", async () => {
      (stockCheckService.listMyChecks as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await storeStockCheck.my(req as any, res as any);
      expect(stockCheckService.listMyChecks).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("my - 未关联门店应返回400", async () => {
      const req = mockReq({ user: {} });
      const res = mockRes();
      await storeStockCheck.my(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(fail).toHaveBeenCalled();
    });

    it("detail - 应返回我的盘点详情", async () => {
      (stockCheckService.getMyCheckDetail as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await storeStockCheck.detail(req as any, res as any);
      expect(stockCheckService.getMyCheckDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateItem - 应更新盘点项", async () => {
      (stockCheckService.updateItemQty as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1, itemId: 1 }, body: { actualQty: 10 } });
      const res = mockRes();
      await storeStockCheck.updateItem(req as any, res as any);
      expect(stockCheckService.updateItemQty).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("submit - 应提交盘点", async () => {
      (stockCheckService.submitCheck as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await storeStockCheck.submit(req as any, res as any);
      expect(stockCheckService.submitCheck).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("aliases", () => {
    it("create should equal adminStockCheck.create", () => expect(create).toBe(adminStockCheck.create));
    it("getStatistics should equal adminStockCheck.statistics", () => expect(getStatistics).toBe(adminStockCheck.statistics));
    it("list should equal adminStockCheck.list", () => expect(list).toBe(adminStockCheck.list));
    it("getDetail should equal adminStockCheck.detail", () => expect(getDetail).toBe(adminStockCheck.detail));
    it("update should equal adminStockCheck.update", () => expect(update).toBe(adminStockCheck.update));
    it("start should equal adminStockCheck.start", () => expect(start).toBe(adminStockCheck.start));
    it("complete should equal adminStockCheck.complete", () => expect(complete).toBe(adminStockCheck.complete));
    it("cancel should equal adminStockCheck.cancel", () => expect(cancel).toBe(adminStockCheck.cancel));
    it("handleDiff should equal adminStockCheck.handleDiff", () => expect(handleDiff).toBe(adminStockCheck.handleDiff));
    it("getMyList should equal storeStockCheck.my", () => expect(getMyList).toBe(storeStockCheck.my));
    it("updateItem should equal storeStockCheck.updateItem", () => expect(updateItem).toBe(storeStockCheck.updateItem));
    it("submit should equal storeStockCheck.submit", () => expect(submit).toBe(storeStockCheck.submit));
  });
});