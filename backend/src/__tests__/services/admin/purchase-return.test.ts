/**
 * 采购退货 service 单元测试
 * 被测文件：src/services/admin/purchase-return.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  list,
  getDetail,
  create,
  approve,
  voidReturn,
  purchaseReturn,
  listPurchaseReturns,
} from "../../../services/admin/purchase-return.service.js";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("CGTH0001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("purchase-return.service - list", () => {
  it("无可选筛选条件（conditions 为空，whereClause 只含 tenant_id）", async () => {
    mocks.query.mockResolvedValue([{ return_no: "R1" }]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual([{ return_no: "R1" }]);
  });

  it("传入全部筛选条件（conditions 非空）", async () => {
    mocks.query.mockResolvedValue([]);
    await list({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, returnStatus: "PENDING", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(mocks.query).toHaveBeenCalledOnce();
  });
});

describe("purchase-return.service - getDetail", () => {
  it("退货单存在时返回含明细", async () => {
    mocks.queryOne.mockResolvedValue({ return_no: "R1" });
    mocks.query.mockResolvedValue([{ id: 1 }]);
    const res = await getDetail("R1", "t1");
    expect(res).toEqual({ return_no: "R1", items: [{ id: 1 }] });
  });

  it("退货单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getDetail("NO", "t1")).rejects.toMatchObject({ statusCode: 404, message: "退货单不存在" });
  });
});

describe("purchase-return.service - create", () => {
  it("成功创建（box_qty/bottle_qty/tax_rate/reason 均有值，走 || 左分支）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      order_no: "CG001", supplier_id: 1, supplier_name: "供应商A", store_id: 2,
      items: [{ sku_id: 1, sku_name: "A", box_qty: 1, bottle_qty: 6, unit_price: 10, tax_rate: 0.13, reason: "破损" }],
    }, "t1", 5, "admin");
    expect(res).toEqual({ return_no: "CGTH0001" });
  });

  it("成功创建（box_qty/bottle_qty/tax_rate/reason 均缺失，走 || 右分支兜底 0）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      supplier_id: 1, supplier_name: "供应商A", store_id: 2,
      items: [{ sku_id: 2, sku_name: "B", unit_price: 5 }],
    }, "t1", 5, "admin");
    expect(res.return_no).toBe("CGTH0001");
  });

  it("order_no/remark 缺失时走 || null 分支", async () => {
    mockConn.query.mockResolvedValue([]);
    await create({
      supplier_id: 1, supplier_name: "供应商A", store_id: 2,
      items: [{ sku_id: 1, sku_name: "A", unit_price: 5 }],
    }, "t1", 5, "admin");
    expect(mockConn.query).toHaveBeenCalled();
  });
});

describe("purchase-return.service - approve", () => {
  it("退货单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(approve("NO", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "COMPLETED", store_id: 2 });
    await expect(approve("R1", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 400, message: "只有待审核状态的退货单可以审核" });
  });

  it("库存充足时审核成功（newBalance 为空覆盖 afterQty || 0 右分支）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 5 }], undefined])
      .mockResolvedValueOnce([[{ physical_qty: 10 }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await approve("R1", "t1", 5, "admin");
    expect(res).toEqual({ return_no: "R1" });
  });

  it("库存不足时抛错（currentQty < total_bottle_qty）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 5 }], undefined])
      .mockResolvedValueOnce([[{ physical_qty: 3 }], undefined]);
    await expect(approve("R1", "t1", 5, "admin")).rejects.toThrow("库存不足");
  });

  it("库存余额为空时 currentQty 兜底 0 抛错（|| 0 右分支）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 1 }], undefined])
      .mockResolvedValueOnce([[], undefined]);
    await expect(approve("R1", "t1", 5, "admin")).rejects.toThrow("库存不足");
  });
});

describe("purchase-return.service - voidReturn", () => {
  it("退货单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(voidReturn("NO", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "COMPLETED" });
    await expect(voidReturn("R1", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 400, message: "只有待审核状态的退货单可以作废" });
  });

  it("成功作废", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, return_status: "PENDING" });
    mocks.query.mockResolvedValue([]);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await voidReturn("R1", "t1", 5, "admin");
    expect(res).toEqual({ return_no: "R1" });
  });
});

describe("purchase-return.service - purchaseReturn", () => {
  it("供应商不存在时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(purchaseReturn({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      items: [{ skuId: 1, skuName: "A", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13 }],
    })).rejects.toMatchObject({ statusCode: 400, message: "供应商不存在" });
  });

  it("成功退货（含批次扣库存，taxRate 非 0）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A" });
    mockConn.execute.mockResolvedValueOnce([{ insertId: 9 }]).mockResolvedValue([]);
    const res = await purchaseReturn({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1, orderNo: "CG001",
      items: [
        { skuId: 1, skuName: "A", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13, reason: "r" },
        { skuId: 2, skuName: "B", boxQty: 0, bottleQty: 6, totalBottleQty: 6, unitPrice: 5, taxRate: 0 },
      ],
    });
    expect(res).toEqual({ returnId: 9, returnNo: "CGTH0001" });
  });

  it("orderNo/stockNo/remark 缺失走 ?? null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A" });
    mockConn.execute.mockResolvedValueOnce([{ insertId: 10 }]).mockResolvedValue([]);
    const res = await purchaseReturn({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      items: [{ skuId: 1, skuName: "A", boxQty: 0, bottleQty: 1, totalBottleQty: 1, unitPrice: 5, taxRate: 0 }],
    });
    expect(res.returnId).toBe(10);
  });
});

describe("purchase-return.service - listPurchaseReturns", () => {
  it("无可选筛选条件", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listPurchaseReturns({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("传入全部筛选条件", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listPurchaseReturns({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, returnStatus: "PENDING", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await listPurchaseReturns({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});
