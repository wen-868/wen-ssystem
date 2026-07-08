/**
 * 采购计划 service 单元测试
 * 被测文件：src/services/admin/purchase-plan.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  suggestPurchasePlan,
  createPurchasePlan,
  listPurchasePlans,
  convertPurchasePlan,
} from "../../../services/admin/purchase-plan.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("JH0001");
});

describe("purchase-plan.service - suggestPurchasePlan", () => {
  it("不带 storeId（storeCondition 为空，if false 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { skuId: 1, skuName: "A", currentStock: 5, safetyStock: 20, monthlyAvgSales: 10, inTransitQty: 8 },
      { skuId: 2, skuName: "B", currentStock: undefined, safetyStock: undefined, monthlyAvgSales: undefined, inTransitQty: undefined },
    ]);
    const res = await suggestPurchasePlan("t1");
    expect(res).toHaveLength(2);
    expect(res[0].inTransitQty).toBe(8);
    expect(res[0].reason).toContain("在途");
    expect(res[1].currentStock).toBe(0);
    expect(res[1].reason).not.toContain("在途");
  });

  it("带 storeId（storeCondition 非空，if true 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await suggestPurchasePlan("t1", 3);
    expect(res).toEqual([]);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

describe("purchase-plan.service - createPurchasePlan", () => {
  it("成功创建（skuInfo 有值走 ?. 左 + ?? 左；skuInfo 为 null 走 ?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ sku_name: "A", safety_stock: 20, physical_qty: 5 })
      .mockResolvedValueOnce(null);
    const res = await createPurchasePlan({
      supplierId: 1, storeId: 2, tenantId: "t1",
      items: [{ skuId: 1, suggestQty: 10 }, { skuId: 2, suggestQty: 5 }],
    });
    expect(res).toEqual({ planNo: "JH0001", supplierId: 1, storeId: 2, itemsCount: 2 });
  });
});

describe("purchase-plan.service - listPurchasePlans", () => {
  it("无可选筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ planNo: "JH1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPurchasePlans({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ planNo: "JH1" }] });
  });

  it("传入全部筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listPurchasePlans({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, status: "DRAFT" });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPurchasePlans({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("purchase-plan.service - convertPurchasePlan", () => {
  it("计划不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(convertPurchasePlan("NO", "t1")).rejects.toThrow("采购计划不存在");
  });

  it("计划状态非 DRAFT/CONFIRMED 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ plan_no: "JH1", supplier_id: 1, store_id: 2, plan_status: "CONVERTED" });
    await expect(convertPurchasePlan("JH1", "t1")).rejects.toThrow("计划已转换");
  });

  it("成功转换（DRAFT 状态，price 有值走 ?. 左 + ?? 左）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ plan_no: "JH1", supplier_id: 1, store_id: 2, plan_status: "DRAFT" })
      .mockResolvedValueOnce({ purchasePrice: 10 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ skuId: 1, suggestQty: 5 }])
      .mockResolvedValue([]);
    const res = await convertPurchasePlan("JH1", "t1");
    expect(res).toEqual({ planNo: "JH1", orderNo: "JH0001", status: "CONVERTED", totalAmount: 50 });
  });

  it("成功转换（CONFIRMED 状态，price 为 null 走 ?. 右 + ?? 右）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ plan_no: "JH2", supplier_id: 1, store_id: 2, plan_status: "CONFIRMED" })
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ skuId: 2, suggestQty: 3 }])
      .mockResolvedValue([]);
    const res = await convertPurchasePlan("JH2", "t1");
    expect(res.totalAmount).toBe(0);
  });
});
