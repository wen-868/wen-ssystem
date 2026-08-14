/**
 * 管理端库存成本 controller 单元测试
 * 被测文件：src/controllers/admin/inventory-cost.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  getInventoryCostDetail: vi.fn(),
  getInventoryCostTrend: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/inventory-cost.service", () => ({
  getInventoryCostDetail: mocks.getInventoryCostDetail,
  getInventoryCostTrend: mocks.getInventoryCostTrend,
}));

import {
  getInventoryCostDetail,
  getInventoryCostTrend,
} from "../../../controllers/admin/inventory-cost.controller";

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

describe("admin inventory-cost.controller", () => {
  it("getInventoryCostDetail 正常调用 service 并返回结果", async () => {
    mocks.getInventoryCostDetail.mockResolvedValue({ totalCost: 1000 });
    const req = mockReq();
    const res = mockRes();
    await getInventoryCostDetail(req, res, vi.fn());
    expect(mocks.getInventoryCostDetail).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(mocks.ok).toHaveBeenCalledWith({ totalCost: 1000 });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { totalCost: 1000 } });
  });

  it("getInventoryCostDetail 传入 startDate 和 endDate 查询参数", async () => {
    mocks.getInventoryCostDetail.mockResolvedValue({ totalCost: 500 });
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getInventoryCostDetail(req, res, vi.fn());
    expect(mocks.getInventoryCostDetail).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
  });

  it("getInventoryCostDetail 不传日期参数时为 undefined", async () => {
    mocks.getInventoryCostDetail.mockResolvedValue({});
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getInventoryCostDetail(req, res, vi.fn());
    expect(mocks.getInventoryCostDetail).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("getInventoryCostTrend 正常调用并返回趋势", async () => {
    mocks.getInventoryCostTrend.mockResolvedValue([{ month: "2026-01", cost: 100 }]);
    const req = mockReq();
    const res = mockRes();
    await getInventoryCostTrend(req, res, vi.fn());
    expect(mocks.getInventoryCostTrend).toHaveBeenCalledWith("t1", undefined);
    expect(mocks.ok).toHaveBeenCalledWith([{ month: "2026-01", cost: 100 }]);
  });

  it("getInventoryCostTrend 传入 skuId 时转换为数字", async () => {
    mocks.getInventoryCostTrend.mockResolvedValue([]);
    const req = mockReq({ query: { skuId: "42" } });
    const res = mockRes();
    await getInventoryCostTrend(req, res, vi.fn());
    expect(mocks.getInventoryCostTrend).toHaveBeenCalledWith("t1", 42);
  });

  it("getInventoryCostTrend 不传 skuId 时为 undefined", async () => {
    mocks.getInventoryCostTrend.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getInventoryCostTrend(req, res, vi.fn());
    expect(mocks.getInventoryCostTrend).toHaveBeenCalledWith("t1", undefined);
  });

  it("getInventoryCostDetail 调用 res.json 返回 ok 包装结果", async () => {
    mocks.getInventoryCostDetail.mockResolvedValue({ detail: true });
    const req = mockReq();
    const res = mockRes();
    await getInventoryCostDetail(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { detail: true } });
  });
});
