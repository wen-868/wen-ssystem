import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/trace-records.service.js", () => ({
  generateTraceCodes: vi.fn(),
  listTraceCodes: vi.fn(),
  getTraceCodeDetail: vi.fn(),
  updateTraceCodeStatus: vi.fn(),
  getTraceCodeStatistics: vi.fn(),
  queryTraceChain: vi.fn(),
  verifyTraceCode: vi.fn(),
  createRecall: vi.fn(),
  listRecalls: vi.fn(),
  getRecallDetail: vi.fn(),
  executeRecall: vi.fn(),
  completeRecall: vi.fn(),
  consumerQueryTrace: vi.fn(),
  consumerVerifyTraceCode: vi.fn(),
}));

vi.mock("../../../middleware/tenant.js", () => ({
  getTenantId: (req: any) => req.tenantId,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as traceRecordsService from "../../../services/admin/trace-records.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  generateTraceCodes,
  listTraceCodes,
  getTraceCodeDetail,
  updateTraceCodeStatus,
  getTraceCodeStatistics,
  queryTraceChain,
  verifyTraceCode,
  createRecall,
  listRecalls,
  getRecallDetail,
  executeRecall,
  completeRecall,
  consumerQueryTrace,
  consumerVerifyTraceCode,
} from "../../../controllers/admin/trace-records.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ip: "127.0.0.1",
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

describe("trace-records.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateTraceCodes - 应生成追溯码", async () => {
    (traceRecordsService.generateTraceCodes as any).mockResolvedValue({ count: 10 });
    const req = mockReq({ body: { skuId: 1, quantity: 10 } });
    const res = mockRes();
    await generateTraceCodes(req as any, res as any);
    expect(traceRecordsService.generateTraceCodes).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listTraceCodes - 应返回追溯码列表", async () => {
    (traceRecordsService.listTraceCodes as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listTraceCodes(req as any, res as any);
    expect(traceRecordsService.listTraceCodes).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTraceCodeDetail - 应返回追溯码详情", async () => {
    (traceRecordsService.getTraceCodeDetail as any).mockResolvedValue({ traceCode: "TC123" });
    const req = mockReq({ params: { traceCode: "TC123" } });
    const res = mockRes();
    await getTraceCodeDetail(req as any, res as any);
    expect(traceRecordsService.getTraceCodeDetail).toHaveBeenCalledWith("TC123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getTraceCodeDetail - 追溯码不存在应返回404", async () => {
    (traceRecordsService.getTraceCodeDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { traceCode: "NOT_EXIST" } });
    const res = mockRes();
    await getTraceCodeDetail(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("追溯码不存在", "404");
  });

  it("updateTraceCodeStatus - 应更新追溯码状态", async () => {
    (traceRecordsService.updateTraceCodeStatus as any).mockResolvedValue({ traceCode: "TC123" });
    const req = mockReq({ params: { traceCode: "TC123" }, body: { status: "SOLD" } });
    const res = mockRes();
    await updateTraceCodeStatus(req as any, res as any);
    expect(traceRecordsService.updateTraceCodeStatus).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateTraceCodeStatus - 追溯码不存在应返回404", async () => {
    (traceRecordsService.updateTraceCodeStatus as any).mockResolvedValue(null);
    const req = mockReq({ params: { traceCode: "NOT_EXIST" }, body: { status: "SOLD" } });
    const res = mockRes();
    await updateTraceCodeStatus(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("追溯码不存在", "404");
  });

  it("getTraceCodeStatistics - 应返回统计数据", async () => {
    (traceRecordsService.getTraceCodeStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getTraceCodeStatistics(req as any, res as any);
    expect(traceRecordsService.getTraceCodeStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("queryTraceChain - 应返回追溯链路", async () => {
    (traceRecordsService.queryTraceChain as any).mockResolvedValue({ traceCode: "TC123", chain: [] });
    const req = mockReq({ params: { traceCode: "TC123" } });
    const res = mockRes();
    await queryTraceChain(req as any, res as any);
    expect(traceRecordsService.queryTraceChain).toHaveBeenCalledWith("TC123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("queryTraceChain - 追溯码不存在应返回404", async () => {
    (traceRecordsService.queryTraceChain as any).mockResolvedValue(null);
    const req = mockReq({ params: { traceCode: "NOT_EXIST" } });
    const res = mockRes();
    await queryTraceChain(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("追溯码不存在", "404");
  });

  it("verifyTraceCode - 应验证追溯码", async () => {
    (traceRecordsService.verifyTraceCode as any).mockResolvedValue({ valid: true });
    const req = mockReq({ body: { traceCode: "TC123", scanType: "CONSUMER" } });
    const res = mockRes();
    await verifyTraceCode(req as any, res as any);
    expect(traceRecordsService.verifyTraceCode).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createRecall - 应创建召回", async () => {
    (traceRecordsService.createRecall as any).mockResolvedValue({ recallNo: "RC123" });
    const req = mockReq({ body: { recallType: "BATCH", targetValue: "B001", reason: "质量问题" } });
    const res = mockRes();
    await createRecall(req as any, res as any);
    expect(traceRecordsService.createRecall).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listRecalls - 应返回召回列表", async () => {
    (traceRecordsService.listRecalls as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listRecalls(req as any, res as any);
    expect(traceRecordsService.listRecalls).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getRecallDetail - 应返回召回详情", async () => {
    (traceRecordsService.getRecallDetail as any).mockResolvedValue({ recallNo: "RC123" });
    const req = mockReq({ params: { recallNo: "RC123" } });
    const res = mockRes();
    await getRecallDetail(req as any, res as any);
    expect(traceRecordsService.getRecallDetail).toHaveBeenCalledWith("RC123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getRecallDetail - 召回不存在应返回404", async () => {
    (traceRecordsService.getRecallDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { recallNo: "NOT_EXIST" } });
    const res = mockRes();
    await getRecallDetail(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("召回记录不存在", "404");
  });

  it("executeRecall - 应执行召回", async () => {
    (traceRecordsService.executeRecall as any).mockResolvedValue({ recallNo: "RC123" });
    const req = mockReq({ params: { recallNo: "RC123" } });
    const res = mockRes();
    await executeRecall(req as any, res as any);
    expect(traceRecordsService.executeRecall).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("executeRecall - 召回不存在应返回404", async () => {
    (traceRecordsService.executeRecall as any).mockResolvedValue({ notFound: true });
    const req = mockReq({ params: { recallNo: "NOT_EXIST" } });
    const res = mockRes();
    await executeRecall(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("executeRecall - 召回已结束应返回400", async () => {
    (traceRecordsService.executeRecall as any).mockResolvedValue({ alreadyEnded: true });
    const req = mockReq({ params: { recallNo: "RC123" } });
    const res = mockRes();
    await executeRecall(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("该召回已结束，无法执行", "400");
  });

  it("completeRecall - 应完成召回", async () => {
    (traceRecordsService.completeRecall as any).mockResolvedValue({ recallNo: "RC123" });
    const req = mockReq({ params: { recallNo: "RC123" }, body: { totalNotified: 10, totalReturned: 5 } });
    const res = mockRes();
    await completeRecall(req as any, res as any);
    expect(traceRecordsService.completeRecall).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("completeRecall - 召回不存在应返回404", async () => {
    (traceRecordsService.completeRecall as any).mockResolvedValue({ notFound: true });
    const req = mockReq({ params: { recallNo: "NOT_EXIST" }, body: {} });
    const res = mockRes();
    await completeRecall(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("completeRecall - 召回已结束应返回400", async () => {
    (traceRecordsService.completeRecall as any).mockResolvedValue({ alreadyEnded: true });
    const req = mockReq({ params: { recallNo: "RC123" }, body: {} });
    const res = mockRes();
    await completeRecall(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("该召回已结束", "400");
  });

  it("consumerQueryTrace - 消费者查询追溯", async () => {
    (traceRecordsService.consumerQueryTrace as any).mockResolvedValue({ traceCode: "TC123" });
    const req = mockReq({ params: { traceCode: "TC123" } });
    const res = mockRes();
    await consumerQueryTrace(req as any, res as any);
    expect(traceRecordsService.consumerQueryTrace).toHaveBeenCalledWith("TC123", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("consumerQueryTrace - 追溯码不存在应返回404", async () => {
    (traceRecordsService.consumerQueryTrace as any).mockResolvedValue(null);
    const req = mockReq({ params: { traceCode: "NOT_EXIST" } });
    const res = mockRes();
    await consumerQueryTrace(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("追溯码不存在", "404");
  });

  it("consumerVerifyTraceCode - 消费者验证追溯码", async () => {
    (traceRecordsService.consumerVerifyTraceCode as any).mockResolvedValue({ valid: true });
    const req = mockReq({ body: { traceCode: "TC123" } });
    const res = mockRes();
    await consumerVerifyTraceCode(req as any, res as any);
    expect(traceRecordsService.consumerVerifyTraceCode).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
