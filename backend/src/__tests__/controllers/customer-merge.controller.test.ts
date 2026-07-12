import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/customer-merge.service", () => ({
  detectDuplicates: vi.fn(),
  getCustomerRelations: vi.fn(),
  mergeCustomers: vi.fn(),
  getDuplicateGroups: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerMergeService from "@services/admin/customer-merge.service";
import { ok } from "@shared/response";
import { detectDuplicates, getCustomerRelations, mergeCustomers, getDuplicateGroups } from "@controllers/customer-merge.controller";

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

describe("customer-merge.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detectDuplicates - 应检测重复客户", async () => {
    (customerMergeService.detectDuplicates as any).mockResolvedValue([]);
    const req = mockReq({ query: { type: "mobile" } });
    const res = mockRes();
    await detectDuplicates(req as any, res as any);
    expect(customerMergeService.detectDuplicates).toHaveBeenCalledWith("t1", "mobile");
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerRelations - 应返回客户关联关系", async () => {
    (customerMergeService.getCustomerRelations as any).mockResolvedValue([]);
    const req = mockReq({ params: { customerId: 1 } });
    const res = mockRes();
    await getCustomerRelations(req as any, res as any);
    expect(customerMergeService.getCustomerRelations).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("mergeCustomers - 应合并客户", async () => {
    (customerMergeService.mergeCustomers as any).mockResolvedValue({ success: true });
    const req = mockReq({
      body: {
        primaryCustomerId: 1,
        duplicateCustomerIds: [2, 3],
        mergeName: true,
        mergeMobile: true,
      },
    });
    const res = mockRes();
    await mergeCustomers(req as any, res as any);
    expect(customerMergeService.mergeCustomers).toHaveBeenCalledWith("t1", expect.objectContaining({
      primaryCustomerId: 1,
      duplicateCustomerIds: [2, 3],
    }), 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("mergeCustomers - zod验证失败", async () => {
    const req = mockReq({
      body: {
        primaryCustomerId: "invalid",
        duplicateCustomerIds: [],
      },
    });
    const res = mockRes();
    await expect(mergeCustomers(req as any, res as any)).rejects.toThrow();
  });

  it("getDuplicateGroups - 应返回重复客户组", async () => {
    (customerMergeService.getDuplicateGroups as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await getDuplicateGroups(req as any, res as any);
    expect(customerMergeService.getDuplicateGroups).toHaveBeenCalledWith("t1", 1, 20);
    expect(ok).toHaveBeenCalled();
  });
});