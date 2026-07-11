import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/inventory-batch.service.js", () => ({
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

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as batchService from "../../services/admin/inventory-batch.service.js";
import { ok, fail } from "../../shared/response.js";
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
} from "../../controllers/inventory-batch.controller.js";

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

describe("inventory-batch.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listBatches - 应返回批次列表", async () => {
    (batchService.listBatches as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listBatches(req as any, res as any);
    expect(batchService.listBatches).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getBatchDetail - 批次不存在应返回404", async () => {
    (batchService.getBatchDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getBatchDetail(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("批次不存在", "1");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getBatchDetail - 应返回批次详情", async () => {
    (batchService.getBatchDetail as any).mockResolvedValue({ id: 1, batchNo: "B001" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getBatchDetail(req as any, res as any);
    expect(batchService.getBatchDetail).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("createBatch - 应创建批次", async () => {
    (batchService.createBatch as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { skuId: 1, batchNo: "B001", quantity: 100, storeId: 1 } });
    const res = mockRes();
    await createBatch(req as any, res as any);
    expect(batchService.createBatch).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateBatch - 应更新批次", async () => {
    (batchService.updateBatch as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { quantity: 50 } });
    const res = mockRes();
    await updateBatch(req as any, res as any);
    expect(batchService.updateBatch).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("splitBatch - 应拆分批次", async () => {
    (batchService.splitBatch as any).mockResolvedValue({ newBatchId: 2 });
    const req = mockReq({ params: { id: "1" }, body: { quantity: 30, newBatchNo: "B002" } });
    const res = mockRes();
    await splitBatch(req as any, res as any);
    expect(batchService.splitBatch).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getFifoSuggestion - 应返回FIFO建议", async () => {
    (batchService.getFifoSuggestion as any).mockResolvedValue([]);
    const req = mockReq({ params: { storeId: "1", skuId: "2" } });
    const res = mockRes();
    await getFifoSuggestion(req as any, res as any);
    expect(batchService.getFifoSuggestion).toHaveBeenCalledWith("t1", 1, 2);
    expect(ok).toHaveBeenCalled();
  });

  it("listExpiryConfigs - 应返回效期配置列表", async () => {
    (batchService.listExpiryConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listExpiryConfigs(req as any, res as any);
    expect(batchService.listExpiryConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createExpiryConfig - 应创建效期配置", async () => {
    (batchService.createExpiryConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { skuId: 1, warningDays: 30, dangerDays: 7 } });
    const res = mockRes();
    await createExpiryConfig(req as any, res as any);
    expect(batchService.createExpiryConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateExpiryConfig - 应更新效期配置", async () => {
    (batchService.updateExpiryConfig as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" }, body: { warningDays: 60 } });
    const res = mockRes();
    await updateExpiryConfig(req as any, res as any);
    expect(batchService.updateExpiryConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteExpiryConfig - 应删除效期配置", async () => {
    (batchService.deleteExpiryConfig as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteExpiryConfig(req as any, res as any);
    expect(batchService.deleteExpiryConfig).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("listExpiryAlerts - 应返回效期预警列表", async () => {
    (batchService.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listExpiryAlerts(req as any, res as any);
    expect(batchService.listExpiryAlerts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("handleExpiryAlert - 应处理效期预警", async () => {
    (batchService.handleExpiryAlert as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await handleExpiryAlert(req as any, res as any);
    expect(batchService.handleExpiryAlert).toHaveBeenCalledWith("t1", 1, 1);
    expect(ok).toHaveBeenCalled();
  });

  it("getExpiryAlertStatistics - 应返回效期预警统计", async () => {
    (batchService.getExpiryAlertStatistics as any).mockResolvedValue({ total: 10 });
    const req = mockReq();
    const res = mockRes();
    await getExpiryAlertStatistics(req as any, res as any);
    expect(batchService.getExpiryAlertStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listBatchesBySpu - 别名应与listBatches一致", async () => {
    expect(listBatchesBySpu).toBe(listBatches);
  });

  it("getTraceChain - 批次不存在应返回404", async () => {
    (batchService.getBatchDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getTraceChain(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("批次不存在", "1");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getTraceChain - 应返回批次追溯链", async () => {
    (batchService.getBatchDetail as any).mockResolvedValue({ id: 1, batchNo: "B001" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getTraceChain(req as any, res as any);
    expect(batchService.getBatchDetail).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });
});
