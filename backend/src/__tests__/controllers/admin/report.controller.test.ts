/**
 * 管理端报表 controller 单元测试
 * 被测文件：src/controllers/admin/report.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  getDashboard: vi.fn(),
  getDailySalesTrend: vi.fn(),
  getStoreSalesPerformance: vi.fn(),
  getInventoryAlerts: vi.fn(),
  listInventoryBalance: vi.fn(),
  listInventoryLogs: vi.fn(),
  listCollectionLinks: vi.fn(),
  listPaymentOrders: vi.fn(),
  listRefundOrders: vi.fn(),
  getCollectionLinkStats: vi.fn(),
  revokeCollectionLink: vi.fn(),
  getSalesRanking: vi.fn(),
  getProductRanking: vi.fn(),
  getSalesTrend: vi.fn(),
  getPurchaseSummary: vi.fn(),
  getPurchaseTrend: vi.fn(),
  getSupplierRanking: vi.fn(),
  getInventoryTurnover: vi.fn(),
  getInventoryAge: vi.fn(),
  getInventoryABC: vi.fn(),
  batchCreateCollectionLinks: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/report.service.js", () => ({
  getDashboard: mocks.getDashboard,
  getDailySalesTrend: mocks.getDailySalesTrend,
  getStoreSalesPerformance: mocks.getStoreSalesPerformance,
  getInventoryAlerts: mocks.getInventoryAlerts,
  listInventoryBalance: mocks.listInventoryBalance,
  listInventoryLogs: mocks.listInventoryLogs,
  listCollectionLinks: mocks.listCollectionLinks,
  listPaymentOrders: mocks.listPaymentOrders,
  listRefundOrders: mocks.listRefundOrders,
  getCollectionLinkStats: mocks.getCollectionLinkStats,
  revokeCollectionLink: mocks.revokeCollectionLink,
  getSalesRanking: mocks.getSalesRanking,
  getProductRanking: mocks.getProductRanking,
  getSalesTrend: mocks.getSalesTrend,
  getPurchaseSummary: mocks.getPurchaseSummary,
  getPurchaseTrend: mocks.getPurchaseTrend,
  getSupplierRanking: mocks.getSupplierRanking,
  getInventoryTurnover: mocks.getInventoryTurnover,
  getInventoryAge: mocks.getInventoryAge,
  getInventoryABC: mocks.getInventoryABC,
}));

vi.mock("../../../services/store/sale-bill.service.js", () => ({
  batchCreateCollectionLinks: mocks.batchCreateCollectionLinks,
}));

import {
  getDashboard,
  listInventoryBalance,
  revokeCollectionLink,
  batchCreateCollectionLinks,
  getSalesTrend,
  getInventoryAge,
  getInventoryABC,
} from "../../../controllers/admin/report.controller.js";

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

describe("admin report.controller", () => {
  it("getDashboard 仅传 tenantId", async () => {
    mocks.getDashboard.mockResolvedValue({ salesAmount: 1000 });
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    expect(mocks.getDashboard).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("listInventoryBalance 传递所有查询参数", async () => {
    mocks.listInventoryBalance.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "2", pageSize: "15", keyword: "白酒", storeId: "3", category: "5" } });
    const res = mockRes();
    await listInventoryBalance(req, res);
    expect(mocks.listInventoryBalance).toHaveBeenCalledWith("t1", 2, 15, "白酒", 3, 5);
  });

  it("listInventoryBalance 使用默认值并处理可选参数缺失", async () => {
    mocks.listInventoryBalance.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listInventoryBalance(req, res);
    expect(mocks.listInventoryBalance).toHaveBeenCalledWith("t1", 1, 20, "", undefined, undefined);
  });

  it("revokeCollectionLink 传 linkNo 与 tenantId", async () => {
    mocks.revokeCollectionLink.mockResolvedValue({ linkNo: "L1", status: "REVOKED" });
    const req = mockReq({ params: { linkNo: "L1" } });
    const res = mockRes();
    await revokeCollectionLink(req, res);
    expect(mocks.revokeCollectionLink).toHaveBeenCalledWith("L1", "t1");
  });

  it("batchCreateCollectionLinks 成功批量创建并传递 userId", async () => {
    mocks.batchCreateCollectionLinks.mockResolvedValue({ created: 3 });
    const req = mockReq({
      body: { billNos: ["B1", "B2"], shareChannel: "WECHAT", expireHours: 48 },
    });
    const res = mockRes();
    await batchCreateCollectionLinks(req, res);
    expect(mocks.batchCreateCollectionLinks).toHaveBeenCalledWith(expect.objectContaining({
      billNos: ["B1", "B2"],
      shareChannel: "WECHAT",
      expireHours: 48,
      userId: 1,
      tenantId: "t1",
    }));
    expect(res.json).toHaveBeenCalled();
  });

  it("batchCreateCollectionLinks 缺少 billNos 时 zod 校验抛错", async () => {
    const req = mockReq({ body: { shareChannel: "WECHAT" } });
    const res = mockRes();
    await expect(batchCreateCollectionLinks(req, res)).rejects.toThrow();
    expect(mocks.batchCreateCollectionLinks).not.toHaveBeenCalled();
  });

  it("getSalesTrend 传递 groupBy 与日期范围", async () => {
    mocks.getSalesTrend.mockResolvedValue([{ period: "2026-07" }]);
    const req = mockReq({ query: { groupBy: "month", startDate: "2026-01-01", endDate: "2026-12-31" } });
    const res = mockRes();
    await getSalesTrend(req, res);
    expect(mocks.getSalesTrend).toHaveBeenCalledWith("t1", "month", "2026-01-01", "2026-12-31");
  });

  it("getInventoryAge storeId 有值时传递", async () => {
    mocks.getInventoryAge.mockResolvedValue([{ ageGroup: "0-30天" }]);
    const req = mockReq({ query: { storeId: "2" } });
    const res = mockRes();
    await getInventoryAge(req, res);
    expect(mocks.getInventoryAge).toHaveBeenCalledWith("t1", 2);
  });

  it("getInventoryABC 仅传 tenantId", async () => {
    mocks.getInventoryABC.mockResolvedValue([{ category: "A" }]);
    const req = mockReq();
    const res = mockRes();
    await getInventoryABC(req, res);
    expect(mocks.getInventoryABC).toHaveBeenCalledWith("t1");
  });
});
