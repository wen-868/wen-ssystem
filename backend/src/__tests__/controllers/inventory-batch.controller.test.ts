import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/inventory-batch.service", () => ({
  listBatches: vi.fn(),
  getBatchDetail: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  splitBatch: vi.fn(),
  getFifoSuggestion: vi.fn(),
  listExpiryConfigs: vi.fn(),
  createExpiryConfig: vi.fn(),
  updateExpiryConfig: vi.fn(),
  deleteExpiryConfig: vi.fn(),
  listExpiryAlerts: vi.fn(),
  handleExpiryAlert: vi.fn(),
  getExpiryAlertStatistics: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as inventoryBatchService from "@services/admin/inventory-batch.service";
import { ok, fail } from "@shared/response";
import {
  listBatches,
  getBatchDetail,
  createBatch,
  updateBatch,
  splitBatch,
  getFifoSuggestion,
  listExpiryConfigs,
  createExpiryConfig,
  updateExpiryConfig,
  deleteExpiryConfig,
  listExpiryAlerts,
  handleExpiryAlert,
  getExpiryAlertStatistics,
  listBatchesBySpu,
  getTraceChain,
} from "@controllers/inventory-batch.controller";

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

describe("inventory-batch.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("batch management", () => {
    it("listBatches - 应获取批次列表", async () => {
      (inventoryBatchService.listBatches as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listBatches(req as any, res as any);
      expect(inventoryBatchService.listBatches).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getBatchDetail - 应获取批次详情", async () => {
      (inventoryBatchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await getBatchDetail(req as any, res as any);
      expect(inventoryBatchService.getBatchDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getBatchDetail - 批次不存在应返回404", async () => {
      (inventoryBatchService.getBatchDetail as any).mockResolvedValue(null);
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await getBatchDetail(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(fail).toHaveBeenCalled();
    });

    it("createBatch - 应创建批次", async () => {
      (inventoryBatchService.createBatch as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { skuId: 1, batchNo: "B001", quantity: 100, storeId: 1 } });
      const res = mockRes();
      await createBatch(req as any, res as any);
      expect(inventoryBatchService.createBatch).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("createBatch - zod验证失败", async () => {
      const req = mockReq({ body: { skuId: 0, batchNo: "", quantity: -1 } });
      const res = mockRes();
      await expect(createBatch(req as any, res as any)).rejects.toThrow();
    });

    it("updateBatch - 应更新批次", async () => {
      (inventoryBatchService.updateBatch as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { quantity: 50 } });
      const res = mockRes();
      await updateBatch(req as any, res as any);
      expect(inventoryBatchService.updateBatch).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("splitBatch - 应拆分批次", async () => {
      (inventoryBatchService.splitBatch as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { quantity: 50 } });
      const res = mockRes();
      await splitBatch(req as any, res as any);
      expect(inventoryBatchService.splitBatch).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getFifoSuggestion - 应获取FIFO建议", async () => {
      (inventoryBatchService.getFifoSuggestion as any).mockResolvedValue([]);
      const req = mockReq({ params: { storeId: 1, skuId: 1 } });
      const res = mockRes();
      await getFifoSuggestion(req as any, res as any);
      expect(inventoryBatchService.getFifoSuggestion).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("expiry config", () => {
    it("listExpiryConfigs - 应获取效期配置列表", async () => {
      (inventoryBatchService.listExpiryConfigs as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await listExpiryConfigs(req as any, res as any);
      expect(inventoryBatchService.listExpiryConfigs).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("createExpiryConfig - 应创建效期配置", async () => {
      (inventoryBatchService.createExpiryConfig as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { skuId: 1, warningDays: 7, dangerDays: 3 } });
      const res = mockRes();
      await createExpiryConfig(req as any, res as any);
      expect(inventoryBatchService.createExpiryConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateExpiryConfig - 应更新效期配置", async () => {
      (inventoryBatchService.updateExpiryConfig as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 }, body: { warningDays: 10 } });
      const res = mockRes();
      await updateExpiryConfig(req as any, res as any);
      expect(inventoryBatchService.updateExpiryConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("deleteExpiryConfig - 应删除效期配置", async () => {
      (inventoryBatchService.deleteExpiryConfig as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await deleteExpiryConfig(req as any, res as any);
      expect(inventoryBatchService.deleteExpiryConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("expiry alerts", () => {
    it("listExpiryAlerts - 应获取效期预警列表", async () => {
      (inventoryBatchService.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listExpiryAlerts(req as any, res as any);
      expect(inventoryBatchService.listExpiryAlerts).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("handleExpiryAlert - 应处理效期预警", async () => {
      (inventoryBatchService.handleExpiryAlert as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await handleExpiryAlert(req as any, res as any);
      expect(inventoryBatchService.handleExpiryAlert).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getExpiryAlertStatistics - 应获取效期预警统计", async () => {
      (inventoryBatchService.getExpiryAlertStatistics as any).mockResolvedValue({ total: 0 });
      const req = mockReq();
      const res = mockRes();
      await getExpiryAlertStatistics(req as any, res as any);
      expect(inventoryBatchService.getExpiryAlertStatistics).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("aliases", () => {
    it("listBatchesBySpu should equal listBatches", () => {
      expect(listBatchesBySpu).toBe(listBatches);
    });

    it("getTraceChain - 应返回批次追溯链", async () => {
      (inventoryBatchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await getTraceChain(req as any, res as any);
      expect(inventoryBatchService.getBatchDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });
});