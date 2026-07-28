import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/dashboard.service", () => ({
  getOverview: vi.fn(),
  getSalesTrend: vi.fn(),
  getCategoryPie: vi.fn(),
  getTopProducts: vi.fn(),
  getTopCustomers: vi.fn(),
  getRecentAlerts: vi.fn(),
  getTodos: vi.fn(),
  getRecentOrders: vi.fn(),
  getSalesTrendByDay: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as dashboardService from "@services/admin/dashboard.service";
import { ok } from "@shared/response";
import {
  getOverview,
  getSalesTrend,
  getCategoryPie,
  getTopProducts,
  getTopCustomers,
  getRecentAlerts,
  getTodos,
  getRecentOrders,
  getSalesTrendByDay,
} from "@controllers/admin/dashboard.controller";

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

describe("dashboard.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getOverview - 应返回概览数据", async () => {
    (dashboardService.getOverview as any).mockResolvedValue({ sales: 0, orders: 0 });
    const req = mockReq();
    const res = mockRes();
    await getOverview(req as any, res as any, vi.fn());
    expect(dashboardService.getOverview).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrend - 应返回销售趋势", async () => {
    (dashboardService.getSalesTrend as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getSalesTrend(req as any, res as any, vi.fn());
    expect(dashboardService.getSalesTrend).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getCategoryPie - 应返回分类饼图", async () => {
    (dashboardService.getCategoryPie as any).mockResolvedValue([]);
    const req = mockReq({ query: { dateStart: "2024-01-01", dateEnd: "2024-01-31" } });
    const res = mockRes();
    await getCategoryPie(req as any, res as any, vi.fn());
    expect(dashboardService.getCategoryPie).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTopProducts - 应返回热销商品", async () => {
    (dashboardService.getTopProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: { dateStart: "2024-01-01", dateEnd: "2024-01-31" } });
    const res = mockRes();
    await getTopProducts(req as any, res as any, vi.fn());
    expect(dashboardService.getTopProducts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTopCustomers - 应返回优质客户", async () => {
    (dashboardService.getTopCustomers as any).mockResolvedValue([]);
    const req = mockReq({ query: { dateStart: "2024-01-01", dateEnd: "2024-01-31" } });
    const res = mockRes();
    await getTopCustomers(req as any, res as any, vi.fn());
    expect(dashboardService.getTopCustomers).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getRecentAlerts - 应返回最近预警", async () => {
    (dashboardService.getRecentAlerts as any).mockResolvedValue([]);
    const req = mockReq({ query: { limit: 10 } });
    const res = mockRes();
    await getRecentAlerts(req as any, res as any, vi.fn());
    expect(dashboardService.getRecentAlerts).toHaveBeenCalledWith("t1", 10);
    expect(ok).toHaveBeenCalled();
  });

  it("getTodos - 应返回待办事项", async () => {
    (dashboardService.getTodos as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getTodos(req as any, res as any, vi.fn());
    expect(dashboardService.getTodos).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getRecentOrders - 应返回最近订单", async () => {
    (dashboardService.getRecentOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: { limit: 5 } });
    const res = mockRes();
    await getRecentOrders(req as any, res as any, vi.fn());
    expect(dashboardService.getRecentOrders).toHaveBeenCalledWith("t1", 5);
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrendByDay - 应返回按天销售趋势", async () => {
    (dashboardService.getSalesTrendByDay as any).mockResolvedValue([]);
    const req = mockReq({ query: { days: 7 } });
    const res = mockRes();
    await getSalesTrendByDay(req as any, res as any, vi.fn());
    expect(dashboardService.getSalesTrendByDay).toHaveBeenCalledWith("t1", 7);
    expect(ok).toHaveBeenCalled();
  });

  it("getCategoryPie - 不传dateStart/dateEnd时使用默认值", async () => {
    (dashboardService.getCategoryPie as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getCategoryPie(req as any, res as any, vi.fn());
    expect(dashboardService.getCategoryPie).toHaveBeenCalled();
  });

  it("getTopProducts - 不传dateStart/dateEnd时使用默认值", async () => {
    (dashboardService.getTopProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getTopProducts(req as any, res as any, vi.fn());
    expect(dashboardService.getTopProducts).toHaveBeenCalled();
  });

  it("getTopCustomers - 不传dateStart/dateEnd时使用默认值", async () => {
    (dashboardService.getTopCustomers as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getTopCustomers(req as any, res as any, vi.fn());
    expect(dashboardService.getTopCustomers).toHaveBeenCalled();
  });

  it("getRecentAlerts - 不传limit时使用默认值10", async () => {
    (dashboardService.getRecentAlerts as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getRecentAlerts(req as any, res as any, vi.fn());
    expect(dashboardService.getRecentAlerts).toHaveBeenCalledWith("t1", 10);
  });

  it("getRecentOrders - 不传limit时使用默认值5", async () => {
    (dashboardService.getRecentOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getRecentOrders(req as any, res as any, vi.fn());
    expect(dashboardService.getRecentOrders).toHaveBeenCalledWith("t1", 5);
  });

  it("getSalesTrendByDay - 不传days时使用默认值7", async () => {
    (dashboardService.getSalesTrendByDay as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getSalesTrendByDay(req as any, res as any, vi.fn());
    expect(dashboardService.getSalesTrendByDay).toHaveBeenCalledWith("t1", 7);
  });
});