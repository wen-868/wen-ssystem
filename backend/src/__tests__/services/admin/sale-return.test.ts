/**
 * 销售退货 service 单元测试
 * 被测文件：src/services/sale-return.service.ts
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

import { saleReturnService } from "../../../services/sale-return.service";

const mockConn = { execute: vi.fn() };

const ctx = { tenantId: "t1", userId: 1, username: "admin" } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("TH20260709000001");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

describe("sale-return.service - getPageList", () => {
  it("无可选条件 + countRow 有值（?. 左 + ?? 左）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ return_no: "TH1" }]);
    const res = await saleReturnService.getPageList(
      undefined, undefined, undefined, undefined, undefined, undefined,
      1, 10, ctx,
    );
    expect(res).toEqual({ records: [{ return_no: "TH1" }], total: 1, page: 1, pageSize: 10 });
  });

  it("全部可选条件有值", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await saleReturnService.getPageList(
      "关键词", 1, 2, "PENDING", "2026-01-01", "2026-12-31",
      1, 10, ctx,
    );
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("countRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await saleReturnService.getPageList(
      undefined, undefined, undefined, undefined, undefined, undefined,
      1, 10, ctx,
    );
    expect(res.total).toBe(0);
  });
});

describe("sale-return.service - getDetail", () => {
  it("退货单存在时返回带 items 的详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1" });
    mocks.query.mockResolvedValue([{ sku_id: 1 }]);
    const res = await saleReturnService.getDetail("TH1", ctx);
    expect(res).toEqual({ return_no: "TH1", items: [{ sku_id: 1 }] });
  });

  it("退货单不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await saleReturnService.getDetail("TH1", ctx);
    expect(res).toBeNull();
  });
});

describe("sale-return.service - createReturn", () => {
  it("全部可选字段有值（覆盖所有 || 左 + ?? 左分支）", async () => {
    mockConn.execute.mockResolvedValue([]);
    const res = await saleReturnService.createReturn({
      sourceBillNo: "XS001", storeId: 1, customerId: 10, customerName: "张三",
      customerMobile: "13800000000", discountAmount: 50, remark: "备注",
      items: [{ skuId: 1, skuName: "A", boxQty: 1, bottleQty: 2, unitPrice: 10, reason: "破损" }],
    }, ctx);
    expect(res).toEqual({ returnNo: "TH20260709000001" });
  });

  it("全部可选字段缺失（覆盖所有 || 右 + ?? 右分支）", async () => {
    mockConn.execute.mockResolvedValue([]);
    const res = await saleReturnService.createReturn({
      storeId: 2,
      items: [{ skuId: 2, skuName: "B", boxQty: 0, bottleQty: 5, unitPrice: 20 }],
    } as any, ctx);
    expect(res).toEqual({ returnNo: "TH20260709000001" });
  });
});

describe("sale-return.service - approve", () => {
  it("退货单不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await saleReturnService.approve("TH1", ctx);
    expect(res).toBeNull();
  });

  it("状态非 PENDING 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1", return_status: "COMPLETED", store_id: 1 });
    await expect(saleReturnService.approve("TH1", ctx)).rejects.toThrow("只有待审核状态的退货单可以审核");
  });

  it("成功审核 + items 有值（itemRows.length > 0 true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1", return_status: "PENDING", store_id: 1 });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("SELECT sku_id, total_bottle_qty")) {
        return Promise.resolve([[{ sku_id: 1, total_bottle_qty: 5 }], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await saleReturnService.approve("TH1", ctx);
    expect(res).toEqual({ returnNo: "TH1" });
  });

  it("成功审核 + items 为空（itemRows.length > 0 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH2", return_status: "PENDING", store_id: 1 });
    mockConn.execute.mockImplementation((sql: string) => {
      if (sql.includes("SELECT sku_id, total_bottle_qty")) {
        return Promise.resolve([[], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await saleReturnService.approve("TH2", ctx);
    expect(res).toEqual({ returnNo: "TH2" });
  });
});

describe("sale-return.service - refund", () => {
  it("退货单不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await saleReturnService.refund("TH1", { refundMethod: "WECHAT" }, ctx);
    expect(res).toBeNull();
  });

  it("状态非 COMPLETED 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1", return_status: "PENDING", refunded_amount: 0, refund_amount: 100 });
    await expect(saleReturnService.refund("TH1", { refundMethod: "WECHAT" }, ctx)).rejects.toThrow("只有已完成的退货单可以退款");
  });

  it("已全额退款时抛错（refunded >= refund true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1", return_status: "COMPLETED", refunded_amount: 100, refund_amount: 100 });
    await expect(saleReturnService.refund("TH1", { refundMethod: "WECHAT" }, ctx)).rejects.toThrow("退货单已全额退款");
  });

  it("成功退款（refunded < refund false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH1", return_status: "COMPLETED", refunded_amount: 0, refund_amount: 100 });
    mockConn.execute.mockResolvedValue([]);
    const res = await saleReturnService.refund("TH1", { refundMethod: "WECHAT" }, ctx);
    expect(res).toEqual({ returnNo: "TH1" });
  });
});

describe("sale-return.service - getSaleBill", () => {
  it("销售单存在时返回带 items 的详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1" });
    mocks.queryWithTenant.mockResolvedValue([{ sku_id: 1 }]);
    const res = await saleReturnService.getSaleBill("XS1", ctx);
    expect(res).toEqual({ bill_no: "XS1", items: [{ sku_id: 1 }] });
  });

  it("销售单不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await saleReturnService.getSaleBill("XS1", ctx);
    expect(res).toBeNull();
  });
});
