﻿﻿﻿﻿﻿/**
 * 采购入库 service 单元测试
 * 被测文件：src/services/admin/purchase-in-stock.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  bindTraceCodeOnInStock: vi.fn(),
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

vi.mock("../../../shared/trace-code", () => ({
  bindTraceCodeOnInStock: mocks.bindTraceCodeOnInStock,
}));

import {
  list,
  getDetail,
  create,
  approve,
  voidStock,
  purchaseInStock,
  listPurchaseInStocks,
  getPurchaseInStockDetail,
} from "../../../services/admin/purchase-in-stock.service";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("RK0001");
  mocks.bindTraceCodeOnInStock.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("purchase-in-stock.service - list", () => {
  it("无可选筛选条件（conditions 为空）", async () => {
    mocks.query.mockResolvedValue([{ stock_no: "S1" }]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual([{ stock_no: "S1" }]);
  });

  it("传入全部筛选条件（conditions 非空）", async () => {
    mocks.query.mockResolvedValue([]);
    await list({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, stockStatus: "PENDING", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(mocks.query).toHaveBeenCalledOnce();
  });
});

describe("purchase-in-stock.service - getDetail", () => {
  it("入库单存在时返回含明细", async () => {
    mocks.queryOne.mockResolvedValue({ stock_no: "S1" });
    mocks.query.mockResolvedValue([{ id: 1 }]);
    const res = await getDetail("S1", "t1");
    expect(res).toEqual({ stock_no: "S1", items: [{ id: 1 }] });
  });

  it("入库单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getDetail("NO", "t1")).rejects.toMatchObject({ statusCode: 404, message: "入库单不存在" });
  });
});

describe("purchase-in-stock.service - create", () => {
  it("成功创建（全字段有值，走 || 左分支）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      order_no: "CG001", supplier_id: 1, supplier_name: "供应商A", store_id: 2,
      items: [{
        sku_id: 1, sku_name: "A", box_qty: 1, bottle_qty: 6, unit_price: 10, tax_rate: 0.13,
        batch_no: "B1", production_date: "2026-01-01", expiry_date: "2027-01-01", remark: "r",
      }],
    }, "t1", 5, "admin");
    expect(res).toEqual({ stock_no: "RK0001" });
  });

  it("成功创建（可选字段全缺失，走 || 0 / || null 右分支）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      supplier_id: 1, supplier_name: "供应商A", store_id: 2,
      items: [{ sku_id: 2, sku_name: "B", unit_price: 5 }],
    }, "t1", 5, "admin");
    expect(res.stock_no).toBe("RK0001");
  });
});

describe("purchase-in-stock.service - approve", () => {
  it("入库单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(approve("NO", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "COMPLETED", store_id: 2 });
    await expect(approve("S1", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 400, message: "只有待审核状态的入库单可以审核" });
  });

  it("审核成功（item 有 batch_no，走 INSERT batch 分支；balance 有值走 Number 左分支）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 5, batch_no: "B1", production_date: "2026-01-01", expiry_date: "2027-01-01" }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ physical_qty: 5 }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await approve("S1", "t1", 5, "admin");
    expect(res).toEqual({ stock_no: "S1" });
  });

  it("审核成功（item 无 batch_no，跳过 INSERT batch；balance 为空走 Number(undefined) || 0 右分支）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 5, batch_no: null, production_date: null, expiry_date: null }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await approve("S1", "t1", 5, "admin");
    expect(res).toEqual({ stock_no: "S1" });
  });

  it("审核成功（item 有 batch_no，production_date/expiry_date 为 null 走 || null 右分支）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "PENDING", store_id: 2 });
    mockConn.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ sku_id: 1, total_bottle_qty: 5, batch_no: "B2", production_date: null, expiry_date: null }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ physical_qty: 8 }], undefined])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await approve("S1", "t1", 5, "admin");
    expect(res).toEqual({ stock_no: "S1" });
  });
});

describe("purchase-in-stock.service - voidStock", () => {
  it("入库单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(voidStock("NO", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "COMPLETED" });
    await expect(voidStock("S1", "t1", 5, "admin")).rejects.toMatchObject({ statusCode: 400, message: "只有待审核状态的入库单可以作废" });
  });

  it("成功作废", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, stock_status: "PENDING" });
    mocks.query.mockResolvedValue([]);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await voidStock("S1", "t1", 5, "admin");
    expect(res).toEqual({ stock_no: "S1" });
  });
});

describe("purchase-in-stock.service - purchaseInStock", () => {
  const baseItems = [
    { skuId: 1, skuName: "A", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13, batchNo: "B1", productionDate: "2026-01-01", expiryDate: "2027-01-01", remark: "r" },
    { skuId: 2, skuName: "B", boxQty: 0, bottleQty: 6, totalBottleQty: 6, unitPrice: 5, taxRate: 0 },
  ];

  it("采购订单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(purchaseInStock(1, { tenantId: "t1", operatorId: 5, items: baseItems })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("订单状态不允许入库时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", supplierId: 1, supplierName: "S", storeId: 2, orderStatus: "DRAFT" });
    await expect(purchaseInStock(1, { tenantId: "t1", operatorId: 5, items: baseItems })).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许入库" });
  });

  it("成功入库（remainingQty<=0 -> COMPLETED，含 batchNo 绑定追溯码）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", supplierId: 1, supplierName: "S", storeId: 2, orderStatus: "APPROVED" });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("INSERT INTO t_purchase_in_stock ")) return Promise.resolve([{ insertId: 100 }]);
      if (sql.includes("remainingQty")) return Promise.resolve([[{ remainingQty: 0 }], undefined]);
      return Promise.resolve([]);
    });
    const res = await purchaseInStock(1, { tenantId: "t1", operatorId: 5, items: baseItems });
    expect(res.orderStatus).toBe("COMPLETED");
    expect(mocks.bindTraceCodeOnInStock).toHaveBeenCalledOnce();
  });

  it("成功入库（remainingQty>0 -> PARTIAL，无 batchNo 不绑定追溯码）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", supplierId: 1, supplierName: "S", storeId: 2, orderStatus: "PARTIAL" });
    const itemsNoBatch = [{ skuId: 3, skuName: "C", boxQty: 0, bottleQty: 1, totalBottleQty: 1, unitPrice: 5, taxRate: 0 }];
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("INSERT INTO t_purchase_in_stock ")) return Promise.resolve([{ insertId: 101 }]);
      if (sql.includes("remainingQty")) return Promise.resolve([[{ remainingQty: 5 }], undefined]);
      return Promise.resolve([]);
    });
    const res = await purchaseInStock(1, { tenantId: "t1", operatorId: 5, items: itemsNoBatch });
    expect(res.orderStatus).toBe("PARTIAL");
    expect(mocks.bindTraceCodeOnInStock).not.toHaveBeenCalled();
  });

  it("成功入库（item 有 batchNo 无 productionDate 走 ?? null 右；remainingQty 为 null 走 ?? 0 右 -> COMPLETED）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", supplierId: 1, supplierName: "S", storeId: 2, orderStatus: "APPROVED" });
    const itemsBatchNoDate = [{ skuId: 4, skuName: "D", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13, batchNo: "B3" }];
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("INSERT INTO t_purchase_in_stock ")) return Promise.resolve([{ insertId: 102 }]);
      if (sql.includes("remainingQty")) return Promise.resolve([[{ remainingQty: null }], undefined]);
      return Promise.resolve([]);
    });
    const res = await purchaseInStock(1, { tenantId: "t1", operatorId: 5, items: itemsBatchNoDate });
    expect(res.orderStatus).toBe("COMPLETED");
    expect(mocks.bindTraceCodeOnInStock).toHaveBeenCalledWith(mockConn, "t1", expect.objectContaining({ productionDate: null }));
  });
});

describe("purchase-in-stock.service - listPurchaseInStocks", () => {
  it("无可选筛选条件", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listPurchaseInStocks({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1 }] });
  });

  it("传入全部筛选条件", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listPurchaseInStocks({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, stockStatus: "PENDING", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await listPurchaseInStocks({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("purchase-in-stock.service - getPurchaseInStockDetail", () => {
  it("入库单存在时返回含明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, stockNo: "S1" });
    mocks.query.mockResolvedValue([{ id: 10 }]);
    const res = await getPurchaseInStockDetail(1, "t1");
    expect(res).toEqual({ id: 1, stockNo: "S1", items: [{ id: 10 }] });
  });

  it("入库单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getPurchaseInStockDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "入库单不存在" });
  });
});
