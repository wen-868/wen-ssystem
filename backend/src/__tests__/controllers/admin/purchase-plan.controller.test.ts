import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-plan.service.js", () => ({
  suggestPurchasePlan: vi.fn(),
  createPurchasePlan: vi.fn(),
  listPurchasePlans: vi.fn(),
  convertPurchasePlan: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchasePlanService from "../../../services/admin/purchase-plan.service.js";
import { ok } from "../../../shared/response.js";
import {
  suggestPurchasePlan,
  createPurchasePlan,
  listPurchasePlans,
  convertPurchasePlan,
} from "../../../controllers/admin/purchase-plan.controller.js";

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

describe("purchase-plan.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suggestPurchasePlan - 应返回采购计划建议", async () => {
    (purchasePlanService.suggestPurchasePlan as any).mockResolvedValue({ items: [] });
    const req = mockReq();
    const res = mockRes();
    await suggestPurchasePlan(req as any, res as any);
    expect(purchasePlanService.suggestPurchasePlan).toHaveBeenCalledWith("t1", undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("suggestPurchasePlan - 应传递 storeId 参数", async () => {
    (purchasePlanService.suggestPurchasePlan as any).mockResolvedValue({ items: [] });
    const req = mockReq({ query: { storeId: "2" } });
    const res = mockRes();
    await suggestPurchasePlan(req as any, res as any);
    expect(purchasePlanService.suggestPurchasePlan).toHaveBeenCalledWith("t1", 2);
    expect(ok).toHaveBeenCalled();
  });

  it("createPurchasePlan - 应创建采购计划", async () => {
    (purchasePlanService.createPurchasePlan as any).mockResolvedValue({ planNo: "PL001" });
    const req = mockReq({
      body: {
        supplierId: 1,
        storeId: 1,
        items: [{ skuId: 1, quantity: 10 }],
      },
    });
    const res = mockRes();
    await createPurchasePlan(req as any, res as any);
    expect(purchasePlanService.createPurchasePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        storeId: 1,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listPurchasePlans - 应返回采购计划列表", async () => {
    (purchasePlanService.listPurchasePlans as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPurchasePlans(req as any, res as any);
    expect(purchasePlanService.listPurchasePlans).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listPurchasePlans - 应传递筛选参数", async () => {
    (purchasePlanService.listPurchasePlans as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "2", pageSize: "10", supplierId: "3", status: "PENDING" } });
    const res = mockRes();
    await listPurchasePlans(req as any, res as any);
    expect(purchasePlanService.listPurchasePlans).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        supplierId: 3,
        status: "PENDING",
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("convertPurchasePlan - 应转换采购计划为订单", async () => {
    (purchasePlanService.convertPurchasePlan as any).mockResolvedValue({ orderNo: "PO001" });
    const req = mockReq({ params: { planNo: "PL001" } });
    const res = mockRes();
    await convertPurchasePlan(req as any, res as any);
    expect(purchasePlanService.convertPurchasePlan).toHaveBeenCalledWith("PL001", "t1");
    expect(ok).toHaveBeenCalled();
  });
});
