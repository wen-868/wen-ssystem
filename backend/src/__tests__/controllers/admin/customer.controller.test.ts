import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/customer.service", () => ({
  listMembers: vi.fn(),
  createCustomer: vi.fn(),
  getCustomerDetail: vi.fn(),
  updateCustomer: vi.fn(),
  disableCustomer: vi.fn(),
  assignStaffToCustomer: vi.fn(),
  getCustomerPriceHistory: vi.fn(),
  listCustomerSaleBills: vi.fn(),
  listCustomerPayments: vi.fn(),
  listCustomerStatements: vi.fn(),
  getCustomerPurchaseStats: vi.fn(),
  getCustomerStats: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerService from "../../../services/admin/customer.service";
import { ok } from "../../../shared/response";
import {
  listMembers, createCustomer, getCustomerDetail, updateCustomer,
  disableCustomer, assignStaffToCustomer, getCustomerPriceHistory,
  listCustomerSaleBills, listCustomerPayments, listCustomerStatements,
  getCustomerPurchaseStats, getCustomerStats
} from "../../../controllers/admin/customer.controller";

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

describe("customer.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listMembers - 应返回会员列表", async () => {
    (customerService.listMembers as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20, keyword: "张" } });
    const res = mockRes();
    await listMembers(req as any, res as any, vi.fn());
    expect(customerService.listMembers).toHaveBeenCalledWith("t1", 1, 20, "张");
    expect(ok).toHaveBeenCalled();
  });

  it("createCustomer - 应创建客户", async () => {
    (customerService.createCustomer as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "新客户", phone: "13800000000" } });
    const res = mockRes();
    await createCustomer(req as any, res as any, vi.fn());
    expect(customerService.createCustomer).toHaveBeenCalledWith("t1", { name: "新客户", phone: "13800000000" });
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerDetail - 应返回客户详情", async () => {
    (customerService.getCustomerDetail as any).mockResolvedValue({ id: 1, name: "客户A" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getCustomerDetail(req as any, res as any, vi.fn());
    expect(customerService.getCustomerDetail).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("updateCustomer - 应更新客户", async () => {
    (customerService.updateCustomer as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { name: "更新客户" } });
    const res = mockRes();
    await updateCustomer(req as any, res as any, vi.fn());
    expect(customerService.updateCustomer).toHaveBeenCalledWith("t1", 1, { name: "更新客户" });
    expect(ok).toHaveBeenCalled();
  });

  it("disableCustomer - 应禁用客户", async () => {
    (customerService.disableCustomer as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await disableCustomer(req as any, res as any, vi.fn());
    expect(customerService.disableCustomer).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("assignStaffToCustomer - 应分配员工", async () => {
    (customerService.assignStaffToCustomer as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { staffId: 5 } });
    const res = mockRes();
    await assignStaffToCustomer(req as any, res as any, vi.fn());
    expect(customerService.assignStaffToCustomer).toHaveBeenCalledWith("t1", 1, 5);
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerPriceHistory - 应返回价格历史", async () => {
    (customerService.getCustomerPriceHistory as any).mockResolvedValue([]);
    const req = mockReq({ params: { id: "1" }, query: { skuId: 2 } });
    const res = mockRes();
    await getCustomerPriceHistory(req as any, res as any, vi.fn());
    expect(customerService.getCustomerPriceHistory).toHaveBeenCalledWith("t1", 1, 2);
    expect(ok).toHaveBeenCalled();
  });

  it("listCustomerSaleBills - 应返回销售单列表", async () => {
    (customerService.listCustomerSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCustomerSaleBills(req as any, res as any, vi.fn());
    expect(customerService.listCustomerSaleBills).toHaveBeenCalledWith("t1", 1, 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("listCustomerPayments - 应返回回款列表", async () => {
    (customerService.listCustomerPayments as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCustomerPayments(req as any, res as any, vi.fn());
    expect(customerService.listCustomerPayments).toHaveBeenCalledWith("t1", 1, 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("listCustomerStatements - 应返回对账单列表", async () => {
    (customerService.listCustomerStatements as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCustomerStatements(req as any, res as any, vi.fn());
    expect(customerService.listCustomerStatements).toHaveBeenCalledWith("t1", 1, 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerPurchaseStats - 应返回购买统计", async () => {
    (customerService.getCustomerPurchaseStats as any).mockResolvedValue({ total: 100 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getCustomerPurchaseStats(req as any, res as any, vi.fn());
    expect(customerService.getCustomerPurchaseStats).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerStats - 应返回客户统计", async () => {
    (customerService.getCustomerStats as any).mockResolvedValue({ total: 100 });
    const req = mockReq();
    const res = mockRes();
    await getCustomerStats(req as any, res as any, vi.fn());
    expect(customerService.getCustomerStats).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listMembers - 不传page/pageSize/keyword时使用默认值", async () => {
    (customerService.listMembers as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listMembers(req as any, res as any, vi.fn());
    expect(customerService.listMembers).toHaveBeenCalledWith("t1", 1, 20, "");
  });

  it("listCustomerSaleBills - 不传page/pageSize时使用默认值", async () => {
    (customerService.listCustomerSaleBills as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();
    await listCustomerSaleBills(req as any, res as any, vi.fn());
    expect(customerService.listCustomerSaleBills).toHaveBeenCalledWith("t1", 1, 1, 20);
  });

  it("listCustomerPayments - 不传page/pageSize时使用默认值", async () => {
    (customerService.listCustomerPayments as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();
    await listCustomerPayments(req as any, res as any, vi.fn());
    expect(customerService.listCustomerPayments).toHaveBeenCalledWith("t1", 1, 1, 20);
  });

  it("listCustomerStatements - 不传page/pageSize时使用默认值", async () => {
    (customerService.listCustomerStatements as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ params: { id: "1" }, query: {} });
    const res = mockRes();
    await listCustomerStatements(req as any, res as any, vi.fn());
    expect(customerService.listCustomerStatements).toHaveBeenCalledWith("t1", 1, 1, 20);
  });
});
