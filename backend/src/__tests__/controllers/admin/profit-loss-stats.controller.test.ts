/**
 * 管理端损益统计 controller 单元测试
 * 被测文件：src/controllers/admin/profit-loss-stats.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  getProfitLossStats: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/profit-loss-stats.service", () => ({
  getProfitLossStats: mocks.getProfitLossStats,
}));

import {
  getProfitLossStats,
} from "../../../controllers/admin/profit-loss-stats.controller";

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

describe("admin profit-loss-stats.controller", () => {
  describe("getProfitLossStats", () => {
    it("获取损益统计（无筛选条件）", async () => {
      mocks.getProfitLossStats.mockResolvedValue({
        totalLossAmount: 1000,
        totalProfitAmount: 500,
        netLossAmount: 500,
      });
      const req = mockReq();
      const res = mockRes();
      await getProfitLossStats(req, res);
      expect(mocks.getProfitLossStats).toHaveBeenCalledWith({
        tenantId: "t1",
        dateStart: undefined,
        dateEnd: undefined,
        storeId: undefined,
      });
      expect(mocks.ok).toHaveBeenCalledWith({
        totalLossAmount: 1000,
        totalProfitAmount: 500,
        netLossAmount: 500,
      });
    });

    it("获取损益统计（带日期范围）", async () => {
      mocks.getProfitLossStats.mockResolvedValue({
        totalLossAmount: 800,
        totalProfitAmount: 300,
        netLossAmount: 500,
      });
      const req = mockReq({
        query: { dateStart: "2026-01-01", dateEnd: "2026-01-31" },
      });
      const res = mockRes();
      await getProfitLossStats(req, res);
      expect(mocks.getProfitLossStats).toHaveBeenCalledWith(expect.objectContaining({
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
      }));
    });

    it("获取损益统计（带 storeId）", async () => {
      mocks.getProfitLossStats.mockResolvedValue({
        totalLossAmount: 200,
        totalProfitAmount: 100,
        netLossAmount: 100,
      });
      const req = mockReq({ query: { storeId: "5" } });
      const res = mockRes();
      await getProfitLossStats(req, res);
      expect(mocks.getProfitLossStats).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 5,
      }));
    });

    it("不传 storeId 时为 undefined", async () => {
      mocks.getProfitLossStats.mockResolvedValue({});
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getProfitLossStats(req, res);
      expect(mocks.getProfitLossStats).toHaveBeenCalledWith(expect.objectContaining({
        storeId: undefined,
      }));
    });
  });
});
