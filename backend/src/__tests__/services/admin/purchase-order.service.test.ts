import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { listPurchaseOrders, getPurchaseOrderDetail, createPurchaseOrder } from "../../../services/admin/purchase-order.service";

describe("admin/purchase-order.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("CG20260815001");
  });

  it("listPurchaseOrders：分页采购单列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ orderNo: "CG001", orderStatus: "PENDING" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listPurchaseOrders({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].orderNo).toBe("CG001");
  });

  it("getPurchaseOrderDetail：返回采购单详情含明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ orderNo: "CG001", orderStatus: "PENDING" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuId: 1, skuName: "酒" }]);
    const detail = await getPurchaseOrderDetail(1, "t1");
    expect(detail?.orderNo).toBe("CG001");
  });

  it("createPurchaseOrder：创建采购单", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, name: "供应商A", tax_rate: 13 });
    const conn = { execute: vi.fn(), query: vi.fn() };
    conn.execute.mockResolvedValueOnce([{ insertId: 9 }]); // INSERT 采购单
    conn.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT 明细
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await createPurchaseOrder({
      supplierId: 1, storeId: 1, tenantId: "t1", operatorId: 2,
      items: [{ skuId: 10, skuName: "酒", boxQty: 1, bottleQty: 12, totalBottleQty: 12, unitPrice: 100, taxRate: 13 }],
    } as any);
    expect(result).not.toBeNull();
    expect(mocks.queryOneWithTenant).toHaveBeenCalled();
  });
});
