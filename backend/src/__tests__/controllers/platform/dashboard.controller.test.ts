import { describe, it, expect, vi, beforeEach } from "vitest";
import * as overviewService from "@services/platform/platform-overview.service";
import { getDashboard, getTenantStats, getRevenueStats } from "@controllers/platform/dashboard.controller";

vi.mock("@services/platform/platform-overview.service");

describe("dashboard.controller", () => {
  const mockRes = {
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboard", () => {
    it("should get platform overview data", async () => {
      const mockResult = { tenants: 10, orders: 100 };
      (overviewService.getPlatformOverview as vi.Mock).mockResolvedValue(mockResult);

      await getDashboard({} as any, mockRes, vi.fn());

      expect(overviewService.getPlatformOverview).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });
  });

  describe("getTenantStats", () => {
    it("should get tenant statistics", async () => {
      const mockResult = { active: 5, inactive: 3 };
      (overviewService.getTenantStatistics as vi.Mock).mockResolvedValue(mockResult);

      await getTenantStats({} as any, mockRes, vi.fn());

      expect(overviewService.getTenantStatistics).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });
  });

  describe("getRevenueStats", () => {
    it("should get revenue statistics", async () => {
      const mockResult = { total: 10000, monthly: 5000 };
      (overviewService.getRevenueStatistics as vi.Mock).mockResolvedValue(mockResult);

      await getRevenueStats({} as any, mockRes, vi.fn());

      expect(overviewService.getRevenueStatistics).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual(mockResult);
    });
  });
});
