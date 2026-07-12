/**
 * 管理端批量调价 controller 单元测试
 * 被测文件：src/controllers/admin/batch-price.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  previewBatchPriceAdjustment: vi.fn(),
  executeBatchPriceAdjustment: vi.fn(),
  listBatchPriceLogs: vi.fn(),
  getBatchPriceDetail: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/batch-price.service", () => ({
  previewBatchPriceAdjustment: mocks.previewBatchPriceAdjustment,
  executeBatchPriceAdjustment: mocks.executeBatchPriceAdjustment,
  listBatchPriceLogs: mocks.listBatchPriceLogs,
  getBatchPriceDetail: mocks.getBatchPriceDetail,
}));

import {
  previewBatchAdjustment,
  executeBatchAdjustment,
  listBatchLogs,
  getBatchDetail,
} from "../../../controllers/admin/batch-price.controller";

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

const validFilter = { keyword: "酒" };
const validAdjustment = { field: "retail_price", method: "PERCENTAGE", value: 10, direction: "INCREASE" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin batch-price.controller", () => {
  it("previewBatchAdjustment 成功预览并使用默认分页", async () => {
    mocks.previewBatchPriceAdjustment.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ body: { filter: validFilter, adjustment: validAdjustment } });
    const res = mockRes();
    await previewBatchAdjustment(req, res);
    expect(mocks.previewBatchPriceAdjustment).toHaveBeenCalledWith(
      validFilter, validAdjustment, "t1", 1, 50
    );
    expect(mocks.ok).toHaveBeenCalledWith({ list: [], total: 0 });
  });

  it("previewBatchAdjustment 自定义分页", async () => {
    mocks.previewBatchPriceAdjustment.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ body: { filter: validFilter, adjustment: validAdjustment, page: 2, pageSize: 20 } });
    const res = mockRes();
    await previewBatchAdjustment(req, res);
    expect(mocks.previewBatchPriceAdjustment).toHaveBeenCalledWith(
      validFilter, validAdjustment, "t1", 2, 20
    );
  });

  it("executeBatchAdjustment 成功执行并传递 userId", async () => {
    mocks.executeBatchPriceAdjustment.mockResolvedValue({ batchNo: "B001", affected: 5 });
    const req = mockReq({ body: { filter: validFilter, adjustment: validAdjustment } });
    const res = mockRes();
    await executeBatchAdjustment(req, res);
    expect(mocks.executeBatchPriceAdjustment).toHaveBeenCalledWith(
      validFilter, validAdjustment, "批量价格调整", 1, "t1"
    );
    expect(mocks.ok).toHaveBeenCalledWith({ batchNo: "B001", affected: 5 });
  });

  it("executeBatchAdjustment 传入自定义 reason", async () => {
    mocks.executeBatchPriceAdjustment.mockResolvedValue({ batchNo: "B002" });
    const req = mockReq({ body: { filter: validFilter, adjustment: validAdjustment, reason: "促销调价" } });
    const res = mockRes();
    await executeBatchAdjustment(req, res);
    expect(mocks.executeBatchPriceAdjustment).toHaveBeenCalledWith(
      validFilter, validAdjustment, "促销调价", 1, "t1"
    );
  });

  it("listBatchLogs 默认分页并传空筛选", async () => {
    mocks.listBatchPriceLogs.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listBatchLogs(req, res);
    expect(mocks.listBatchPriceLogs).toHaveBeenCalledWith(1, 20, "t1", {
      batchNo: undefined, priceType: undefined, operatorId: undefined, startDate: undefined, endDate: undefined,
    });
  });

  it("listBatchLogs 传入筛选条件并 operatorId 转数字", async () => {
    mocks.listBatchPriceLogs.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({
      query: {
        batchNo: "B001", priceType: "retail_price", operatorId: "5",
        startDate: "2026-01-01", endDate: "2026-01-31", page: "2", pageSize: "10",
      },
    });
    const res = mockRes();
    await listBatchLogs(req, res);
    expect(mocks.listBatchPriceLogs).toHaveBeenCalledWith(2, 10, "t1", {
      batchNo: "B001", priceType: "retail_price", operatorId: 5, startDate: "2026-01-01", endDate: "2026-01-31",
    });
  });

  it("getBatchDetail 传入 batchNo 和默认分页", async () => {
    mocks.getBatchPriceDetail.mockResolvedValue({ batchNo: "B001", items: [] });
    const req = mockReq({ params: { batchNo: "B001" } });
    const res = mockRes();
    await getBatchDetail(req, res);
    expect(mocks.getBatchPriceDetail).toHaveBeenCalledWith("B001", "t1", 1, 50);
    expect(mocks.ok).toHaveBeenCalledWith({ batchNo: "B001", items: [] });
  });

  it("getBatchDetail 自定义分页", async () => {
    mocks.getBatchPriceDetail.mockResolvedValue({ batchNo: "B002" });
    const req = mockReq({ params: { batchNo: "B002" }, query: { page: "3", pageSize: "30" } });
    const res = mockRes();
    await getBatchDetail(req, res);
    expect(mocks.getBatchPriceDetail).toHaveBeenCalledWith("B002", "t1", 3, 30);
  });

  it("previewBatchAdjustment 调用 res.json 返回 ok 包装结果", async () => {
    mocks.previewBatchPriceAdjustment.mockResolvedValue({ preview: true });
    const req = mockReq({ body: { filter: validFilter, adjustment: validAdjustment } });
    const res = mockRes();
    await previewBatchAdjustment(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { preview: true } });
  });
});
