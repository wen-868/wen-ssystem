import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/inventory-batch.service", () => ({
  listBatches: vi.fn(),
  getBatchDetail: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  splitBatch: vi.fn(),
  getFifoSuggestion: vi.fn(),
  getBatchTrace: vi.fn(),
  getProductBatches: vi.fn(),
  listExpiryConfigs: vi.fn(),
  createExpiryConfig: vi.fn(),
  updateExpiryConfig: vi.fn(),
  deleteExpiryConfig: vi.fn(),
  listExpiryAlerts: vi.fn(),
  handleExpiryAlert: vi.fn(),
  getExpiryAlertStatistics: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as batchService from "../../../services/admin/inventory-batch.service";
import { ok, fail } from "../../../shared/response";
import {
  listBatches, getBatchDetail, createBatch, updateBatch, splitBatch,
  getFifoSuggestion, getBatchTrace, getProductBatches, listExpiryConfigs,
  createExpiryConfig, updateExpiryConfig, deleteExpiryConfig, listExpiryAlerts,
  handleExpiryAlert, getExpiryAlertStatistics
} from "../../../controllers/admin/inventory-batch.controller";

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
    (batchService.createBatch as any).mockResolvedValue(1);
    const req = mockReq({ body: { storeId: 1, skuId: 2, batchNo: "B001", quantity: 100 } });
    const res = mockRes();
    await createBatch(req as any, res as any);
    expect(batchService.createBatch).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ batchId: 1 });
  });

  it("updateBatch - 应更新批次", async () => {
    (batchService.updateBatch as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, body: { quantity: 50 } });
    const res = mockRes();
    await updateBatch(req as any, res as any);
    expect(batchService.updateBatch).toHaveBeenCalledWith("t1", 1, { quantity: 50 });
    expect(ok).toHaveBeenCalledWith({ batchId: 1 });
  });

  it("splitBatch - 应拆分批次", async () => {
    (batchService.splitBatch as any).mockResolvedValue(2);
    const req = mockReq({ params: { id: "1" }, body: { splitQuantity: 30, newBatchNo: "B002" } });
    const res = mockRes();
    await splitBatch(req as any, res as any);
    expect(batchService.splitBatch).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ newBatchId: 2 });
  });

  it("getFifoSuggestion - 应返回FIFO建议", async () => {
    (batchService.getFifoSuggestion as any).mockResolvedValue([]);
    const req = mockReq({ params: { storeId: "1", skuId: "2" } });
    const res = mockRes();
    await getFifoSuggestion(req as any, res as any);
    expect(batchService.getFifoSuggestion).toHaveBeenCalledWith("t1", 1, 2);
    expect(ok).toHaveBeenCalled();
  });

  it("getBatchTrace - 应返回批次追溯", async () => {
    (batchService.getBatchTrace as any).mockResolvedValue([]);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getBatchTrace(req as any, res as any);
    expect(batchService.getBatchTrace).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("getProductBatches - 应返回商品批次", async () => {
    (batchService.getProductBatches as any).mockResolvedValue([]);
    const req = mockReq({ params: { spuId: "1" } });
    const res = mockRes();
    await getProductBatches(req as any, res as any);
    expect(batchService.getProductBatches).toHaveBeenCalledWith("t1", 1);
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
    (batchService.createExpiryConfig as any).mockResolvedValue(1);
    const req = mockReq({ body: { alertLevel: 1, levelName: "预警", daysBeforeExpiry: 30, action: "REMIND", color: "#ff0000" } });
    const res = mockRes();
    await createExpiryConfig(req as any, res as any);
    expect(batchService.createExpiryConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ configId: 1 });
  });

  it("updateExpiryConfig - 应更新效期配置", async () => {
    (batchService.updateExpiryConfig as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, body: { levelName: "更新预警" } });
    const res = mockRes();
    await updateExpiryConfig(req as any, res as any);
    expect(batchService.updateExpiryConfig).toHaveBeenCalledWith("t1", 1, { levelName: "更新预警" });
    expect(ok).toHaveBeenCalledWith({ configId: 1 });
  });

  it("deleteExpiryConfig - 应删除效期配置", async () => {
    (batchService.deleteExpiryConfig as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteExpiryConfig(req as any, res as any);
    expect(batchService.deleteExpiryConfig).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalledWith({ configId: 1 });
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
    (batchService.handleExpiryAlert as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await handleExpiryAlert(req as any, res as any);
    expect(batchService.handleExpiryAlert).toHaveBeenCalledWith("t1", 1, 1);
    expect(ok).toHaveBeenCalledWith({ alertId: 1 });
  });

  it("getExpiryAlertStatistics - 应返回效期预警统计", async () => {
    (batchService.getExpiryAlertStatistics as any).mockResolvedValue({ total: 10 });
    const req = mockReq();
    const res = mockRes();
    await getExpiryAlertStatistics(req as any, res as any);
    expect(batchService.getExpiryAlertStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  // ==================== 分支覆盖率补充测试 ====================
  it("listBatches - 不传参数时zod使用默认值", async () => {
    (batchService.listBatches as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listBatches(req as any, res as any);
    expect(batchService.listBatches).toHaveBeenCalledWith("t1", expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it("listBatches - 传storeId/skuId时正确解析", async () => {
    (batchService.listBatches as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { storeId: "5", skuId: "3", expiryStatus: "warning" } });
    const res = mockRes();
    await listBatches(req as any, res as any);
    expect(batchService.listBatches).toHaveBeenCalledWith("t1", expect.objectContaining({ storeId: 5, skuId: 3, expiryStatus: "warning" }));
  });

  it("listExpiryAlerts - 不传参数时zod使用默认值", async () => {
    (batchService.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listExpiryAlerts(req as any, res as any);
    expect(batchService.listExpiryAlerts).toHaveBeenCalledWith("t1", expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it("listExpiryAlerts - 传alertLevel/storeId/status时正确解析", async () => {
    (batchService.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { alertLevel: "1", storeId: "2", status: "PENDING" } });
    const res = mockRes();
    await listExpiryAlerts(req as any, res as any);
    expect(batchService.listExpiryAlerts).toHaveBeenCalledWith("t1", expect.objectContaining({ alertLevel: 1, storeId: 2, status: "PENDING" }));
  });

  it("handleExpiryAlert - user无id时正确处理", async () => {
    (batchService.handleExpiryAlert as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, user: {} });
    const res = mockRes();
    await handleExpiryAlert(req as any, res as any);
    expect(batchService.handleExpiryAlert).toHaveBeenCalledWith("t1", 1, undefined);
    expect(ok).toHaveBeenCalled();
  });
});
