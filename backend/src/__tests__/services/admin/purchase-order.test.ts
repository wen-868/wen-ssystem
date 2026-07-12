﻿﻿﻿﻿﻿/**
 * 采购订单 service 单元测试
 * 被测文件：src/services/admin/purchase-order.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listPurchaseOrders,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  confirmPurchaseOrder,
} from "../../../services/admin/purchase-order.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("CG20260709000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("purchase-order.service - listPurchaseOrders", () => {
  it("无可选筛选条件时只带 tenant_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPurchaseOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1 }] });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("传入全部筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listPurchaseOrders({
      page: 2, pageSize: 5, tenantId: "t1",
      supplierId: 3, orderStatus: "DRAFT", operatorId: 7, dateStart: "2026-01-01", dateEnd: "2026-12-31",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPurchaseOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("purchase-order.service - getPurchaseOrderDetail", () => {
  it("订单存在时返回订单及明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 10 }]);
    const res = await getPurchaseOrderDetail(1, "t1");
    expect(res).toEqual({ id: 1, orderNo: "CG001", items: [{ id: 10 }] });
  });

  it("订单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getPurchaseOrderDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "采购订单不存在" });
  });
});

describe("purchase-order.service - createPurchaseOrder", () => {
  it("供应商不存在时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(createPurchaseOrder({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      items: [{ skuId: 1, skuName: "A", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13 }],
    })).rejects.toMatchObject({ statusCode: 400, message: "供应商不存在" });
  });

  it("成功创建（taxRate 非 0，barcode 有值覆盖 ?? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A", tax_rate: 0.13 });
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([]);
    const res = await createPurchaseOrder({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      items: [{ skuId: 1, skuName: "A", barcode: "B001", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13 }],
    });
    expect(res).toEqual({ orderId: 100, orderNo: "CG20260709000001" });
  });

  it("成功创建（taxRate 为 0，走 || 0 分支；expectedDate/remark 为 undefined 走 ?? null）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A", tax_rate: 0 });
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockResolvedValueOnce([]);
    const res = await createPurchaseOrder({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      items: [{ skuId: 2, skuName: "B", boxQty: 0, bottleQty: 6, totalBottleQty: 6, unitPrice: 5, taxRate: 0 }],
    });
    expect(res.orderId).toBe(101);
  });

  it("传入 expectedDate/remark 时写入", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A", tax_rate: 0.13 });
    mockConn.execute
      .mockResolvedValueOnce([{ insertId: 102 }])
      .mockResolvedValueOnce([]);
    await createPurchaseOrder({
      supplierId: 1, storeId: 2, tenantId: "t1", operatorId: 1,
      expectedDate: "2026-08-01", remark: "备注",
      items: [
        { skuId: 1, skuName: "A", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13, remark: "r1" },
        { skuId: 2, skuName: "B", boxQty: 0, bottleQty: 6, totalBottleQty: 6, unitPrice: 5, taxRate: 0 },
      ],
    });
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });
});

describe("purchase-order.service - updatePurchaseOrder", () => {
  it("订单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updatePurchaseOrder(1, { tenantId: "t1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态不允许修改时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", orderStatus: "APPROVED" });
    await expect(updatePurchaseOrder(1, { tenantId: "t1" })).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许修改" });
  });

  it("带 items 全量更新（DRAFT 状态，覆盖 taxRate||0 / barcode??null / remark??null 左右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" })
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" });
    mockConn.execute.mockResolvedValue([]);
    const res = await updatePurchaseOrder(1, {
      tenantId: "t1", expectedDate: "2026-09-01", remark: "改",
      items: [
        { skuId: 1, skuName: "A", barcode: "B001", boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 10, taxRate: 0.13, remark: "r" },
        { skuId: 2, skuName: "B", boxQty: 0, bottleQty: 6, totalBottleQty: 6, unitPrice: 5, taxRate: 0 },
      ],
    });
    expect(res.orderNo).toBe("CG001");
    expect(mockConn.execute).toHaveBeenCalledTimes(4);
  });

  it("仅更新字段无 items（updates.length > 0，走 UPDATE 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "PENDING" })
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "PENDING" });
    mockConn.execute.mockResolvedValue([]);
    const res = await updatePurchaseOrder(1, { tenantId: "t1", remark: "仅备注" });
    expect(res.orderNo).toBe("CG001");
    expect(mockConn.execute).toHaveBeenCalledOnce();
  });

  it("不传任何字段时 updates 为空，不执行 UPDATE（走 if false 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" })
      .mockResolvedValueOnce({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" });
    const res = await updatePurchaseOrder(1, { tenantId: "t1" });
    expect(res.orderNo).toBe("CG001");
    expect(mockConn.execute).not.toHaveBeenCalled();
  });
});

describe("purchase-order.service - cancelPurchaseOrder", () => {
  it("订单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(cancelPurchaseOrder(1, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态不允许取消时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", orderStatus: "APPROVED" });
    await expect(cancelPurchaseOrder(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许取消" });
  });

  it("成功取消（DRAFT 状态）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await cancelPurchaseOrder(1, "t1");
    expect(res).toEqual({ orderId: 1, orderNo: "CG001" });
  });

  it("成功取消（PENDING 状态）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG002", orderStatus: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await cancelPurchaseOrder(1, "t1");
    expect(res.orderNo).toBe("CG002");
  });
});

describe("purchase-order.service - confirmPurchaseOrder", () => {
  it("订单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(confirmPurchaseOrder(1, "t1", 5)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态不允许确认时抛 400（非 DRAFT 且非 PENDING）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", orderStatus: "COMPLETED" });
    await expect(confirmPurchaseOrder(1, "t1", 5)).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许确认" });
  });

  it("成功确认（DRAFT 状态，第一个条件 false 短路）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG001", orderStatus: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await confirmPurchaseOrder(1, "t1", 5);
    expect(res).toEqual({ orderId: 1, orderNo: "CG001", orderStatus: "APPROVED" });
  });

  it("成功确认（PENDING 状态，第一个 true 第二个 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, orderNo: "CG002", orderStatus: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await confirmPurchaseOrder(1, "t1", 5);
    expect(res.orderStatus).toBe("APPROVED");
  });
});
