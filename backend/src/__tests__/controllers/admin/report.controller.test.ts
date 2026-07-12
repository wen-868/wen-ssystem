import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/report.service", () => ({
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
}));

vi.mock("../../../services/store/sale-bill.service", () => ({
  batchCreateCollectionLinks: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as reportService from "../../../services/admin/report.service";
import { ok } from "../../../shared/response";
import {
  getDashboard,
  getDailySalesTrend,
  getStoreSalesPerformance,
  getInventoryAlerts,
  listInventoryBalance,
  listInventoryLogs,
  listCollectionLinks,
  listPaymentOrders,
  listRefundOrders,
  getCollectionLinkStats,
  revokeCollectionLink,
  batchCreateCollectionLinks,
  getSalesRanking,
  getProductRanking,
  getSalesTrend,
  getPurchaseSummary,
  getPurchaseTrend,
  getSupplierRanking,
  getInventoryTurnover,
  getInventoryAge,
  getInventoryABC,
} from "../../../controllers/admin/report.controller";

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

describe("report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDashboard - 应返回仪表板数据", async () => {
    (reportService.getDashboard as any).mockResolvedValue({});
    const req = mockReq({});
    const res = mockRes();
    await getDashboard(req as any, res as any);
    expect(reportService.getDashboard).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getDailySalesTrend - 应返回每日销售趋势", async () => {
    (reportService.getDailySalesTrend as any).mockResolvedValue([]);
    const req = mockReq({});
    const res = mockRes();
    await getDailySalesTrend(req as any, res as any);
    expect(reportService.getDailySalesTrend).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getStoreSalesPerformance - 应返回门店销售业绩", async () => {
    (reportService.getStoreSalesPerformance as any).mockResolvedValue([]);
    const req = mockReq({});
    const res = mockRes();
    await getStoreSalesPerformance(req as any, res as any);
    expect(reportService.getStoreSalesPerformance).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryAlerts - 应返回库存预警", async () => {
    (reportService.getInventoryAlerts as any).mockResolvedValue([]);
    const req = mockReq({});
    const res = mockRes();
    await getInventoryAlerts(req as any, res as any);
    expect(reportService.getInventoryAlerts).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryBalance - 应返回库存余额列表", async () => {
    (reportService.listInventoryBalance as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listInventoryBalance(req as any, res as any);
    expect(reportService.listInventoryBalance).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryLogs - 应返回库存日志列表", async () => {
    (reportService.listInventoryLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listInventoryLogs(req as any, res as any);
    expect(reportService.listInventoryLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listCollectionLinks - 应返回收款链接列表", async () => {
    (reportService.listCollectionLinks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCollectionLinks(req as any, res as any);
    expect(reportService.listCollectionLinks).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listPaymentOrders - 应返回支付订单列表", async () => {
    (reportService.listPaymentOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPaymentOrders(req as any, res as any);
    expect(reportService.listPaymentOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listRefundOrders - 应返回退款订单列表", async () => {
    (reportService.listRefundOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listRefundOrders(req as any, res as any);
    expect(reportService.listRefundOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionLinkStats - 应返回收款链接统计", async () => {
    (reportService.getCollectionLinkStats as any).mockResolvedValue({});
    const req = mockReq({});
    const res = mockRes();
    await getCollectionLinkStats(req as any, res as any);
    expect(reportService.getCollectionLinkStats).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("revokeCollectionLink - 应撤销收款链接", async () => {
    (reportService.revokeCollectionLink as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { linkNo: "CL20240101001" } });
    const res = mockRes();
    await revokeCollectionLink(req as any, res as any);
    expect(reportService.revokeCollectionLink).toHaveBeenCalledWith("CL20240101001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("batchCreateCollectionLinks - 应批量创建收款链接", async () => {
    const saleBillService = await import("../../../services/store/sale-bill.service.js");
    (saleBillService.batchCreateCollectionLinks as any).mockResolvedValue({});
    const req = mockReq({
      body: { billNos: ["SB001", "SB002"] },
    });
    const res = mockRes();
    await batchCreateCollectionLinks(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("batchCreateCollectionLinks - Zod验证失败应抛出错误", async () => {
    const req = mockReq({ body: { billNos: [] } });
    const res = mockRes();
    await expect(batchCreateCollectionLinks(req as any, res as any)).rejects.toThrow();
  });

  it("batchCreateCollectionLinks - 应使用默认expireHours", async () => {
    const saleBillService = await import("../../../services/store/sale-bill.service.js");
    (saleBillService.batchCreateCollectionLinks as any).mockResolvedValue({});
    const req = mockReq({
      body: { billNos: ["SB001"] },
    });
    const res = mockRes();
    await batchCreateCollectionLinks(req as any, res as any);
    expect(saleBillService.batchCreateCollectionLinks).toHaveBeenCalledWith(
      expect.objectContaining({ expireHours: 72 })
    );
  });

  it("getSalesRanking - 应返回销售排行", async () => {
    (reportService.getSalesRanking as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getSalesRanking(req as any, res as any);
    expect(reportService.getSalesRanking).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getProductRanking - 应返回商品排行", async () => {
    (reportService.getProductRanking as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getProductRanking(req as any, res as any);
    expect(reportService.getProductRanking).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrend - 应返回销售趋势", async () => {
    (reportService.getSalesTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { groupBy: "week", startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getSalesTrend(req as any, res as any);
    expect(reportService.getSalesTrend).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseSummary - 应返回采购汇总", async () => {
    (reportService.getPurchaseSummary as any).mockResolvedValue({});
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getPurchaseSummary(req as any, res as any);
    expect(reportService.getPurchaseSummary).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseTrend - 应返回采购趋势", async () => {
    (reportService.getPurchaseTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { groupBy: "day", startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getPurchaseTrend(req as any, res as any);
    expect(reportService.getPurchaseTrend).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierRanking - 应返回供应商排行", async () => {
    (reportService.getSupplierRanking as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getSupplierRanking(req as any, res as any);
    expect(reportService.getSupplierRanking).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryTurnover - 应返回库存周转率", async () => {
    (reportService.getInventoryTurnover as any).mockResolvedValue({});
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getInventoryTurnover(req as any, res as any);
    expect(reportService.getInventoryTurnover).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryAge - 应返回库存龄", async () => {
    (reportService.getInventoryAge as any).mockResolvedValue({});
    const req = mockReq({ query: { storeId: 1 } });
    const res = mockRes();
    await getInventoryAge(req as any, res as any);
    expect(reportService.getInventoryAge).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryABC - 应返回库存ABC分析", async () => {
    (reportService.getInventoryABC as any).mockResolvedValue({});
    const req = mockReq({});
    const res = mockRes();
    await getInventoryABC(req as any, res as any);
    expect(reportService.getInventoryABC).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});