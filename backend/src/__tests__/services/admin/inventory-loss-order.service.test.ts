/**
 * 报损单 service 单元测试
 * 被测文件：src/services/admin/inventory-loss-order.service.ts
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
  listLossOrders,
  getLossOrderDetail,
  createLossOrder,
  approveLossOrder,
  rejectLossOrder,
} from "../../../services/admin/inventory-loss-order.service";

const mockConn = { execute: vi.fn(), query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("BS20260715000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

const sampleItems = [
  { skuId: 1, skuName: "商品A", barcode: "B001", specification: "500ml", unitName: "瓶", qty: 10, costPrice: 50, lossReason: "破损" },
  { skuId: 2, skuName: "商品B", barcode: "B002", specification: "330ml", unitName: "听", qty: 5, costPrice: 20, lossReason: "过期" },
];

describe("inventory-loss-order.service - listLossOrders", () => {
  it("无可选筛选条件时只带 tenant_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, lossNo: "BS001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listLossOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, lossNo: "BS001" }] });
  });

  it("传入全部筛选条件（storeId + status + lossType + dateStart/End + keyword）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listLossOrders({
      page: 2, pageSize: 5, tenantId: "t1",
      storeId: 1, status: "DRAFT", lossType: "DAMAGE",
      dateStart: "2026-01-01", dateEnd: "2026-12-31",
      keyword: "测试",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listLossOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("inventory-loss-order.service - getLossOrderDetail", () => {
  it("报损单存在时返回详情及明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, lossNo: "BS001", status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 10, skuId: 1, qty: 5 }]);
    const res = await getLossOrderDetail(1, "t1");
    expect(res.id).toBe(1);
    expect(res.items.length).toBe(1);
  });

  it("报损单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getLossOrderDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "报损单不存在" });
  });
});

describe("inventory-loss-order.service - createLossOrder", () => {
  it("明细为空时抛 400", async () => {
    await expect(createLossOrder({
      storeId: 1, lossType: "NORMAL", operatorId: 1, tenantId: "t1", items: [],
    })).rejects.toMatchObject({ statusCode: 400, message: "报损单明细不能为空" });
  });

  it("成功创建报损单（完整字段，走 ?? 左）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 100 }]);
    const res = await createLossOrder({
      storeId: 1,
      storeName: "总店",
      lossType: "DAMAGE",
      reason: "运输破损",
      remark: "备注",
      operatorId: 1,
      operatorName: "张三",
      tenantId: "t1",
      items: sampleItems,
    });
    expect(res).toEqual({ id: 100, lossNo: "BS20260715000001" });
    expect(mockConn.execute).toHaveBeenCalledTimes(3); // 主表 + 2条明细
  });

  it("成功创建报损单（可选字段 undefined，走 ?? null 右）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 101 }]);
    const res = await createLossOrder({
      storeId: 1,
      lossType: "NORMAL",
      operatorId: 1,
      tenantId: "t1",
      items: [{ skuId: 3, skuName: "商品C", qty: 1, costPrice: 100 }],
    });
    expect(res.id).toBe(101);
    // 第1个 execute 是主表插入，storeName 应为 null
    const firstCall = mockConn.execute.mock.calls[0];
    expect(firstCall[1][2]).toBeNull(); // storeName
    // 第2个 execute 是明细插入，barcode 等应为 null
    const secondCall = mockConn.execute.mock.calls[1];
    expect(secondCall[1][4]).toBeNull(); // barcode
  });
});

describe("inventory-loss-order.service - approveLossOrder", () => {
  it("报损单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(approveLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("已审核状态不允许再审核，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED", lossNo: "BS001", storeId: 1 });
    await expect(approveLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许审核通过" });
  });

  it("已驳回状态不允许再审核，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "REJECTED", lossNo: "BS001", storeId: 1 });
    await expect(approveLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("PENDING 状态成功审核通过（status === PENDING 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", lossNo: "BS001", storeId: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    mockConn.query.mockResolvedValue([
      [{ skuId: 1, qty: 10, costPrice: 50 }],
      []
    ]);
    const res = await approveLossOrder(1, { auditorId: 1, auditorName: "李四", tenantId: "t1" });
    expect(res).toEqual({ success: true });
    // 1次UPDATE状态 + 1次明细查询 + 1次库存更新 + 1次台账 = 4次execute + 1次query
    expect(mockConn.execute).toHaveBeenCalledTimes(3);
  });

  it("DRAFT 状态成功审核通过（status === DRAFT 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT", lossNo: "BS002", storeId: 2 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    mockConn.query.mockResolvedValue([
      [{ skuId: 2, qty: 5, costPrice: 20 }],
      []
    ]);
    const res = await approveLossOrder(1, { auditorId: 2, tenantId: "t1" });
    expect(res).toEqual({ success: true });
  });

  it("auditorName 为 undefined 时走 ?? null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", lossNo: "BS003", storeId: 1 });
    mockConn.execute.mockResolvedValue({ affectedRows: 1 });
    mockConn.query.mockResolvedValue([[], []]);
    await approveLossOrder(1, { auditorId: 1, tenantId: "t1" });
    // UPDATE 中 auditorName 应为 null
    const updateCall = mockConn.execute.mock.calls[0];
    expect(updateCall[1][1]).toBeNull();
  });
});

describe("inventory-loss-order.service - rejectLossOrder", () => {
  it("报损单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(rejectLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("已审核状态不允许驳回，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED" });
    await expect(rejectLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 400, message: "当前状态不允许驳回" });
  });

  it("已驳回状态不允许再驳回，抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "REJECTED" });
    await expect(rejectLossOrder(1, { auditorId: 1, tenantId: "t1" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("PENDING 状态成功驳回（status === PENDING + rejectReason 有值）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await rejectLossOrder(1, { auditorId: 1, auditorName: "李四", rejectReason: "数量不对", tenantId: "t1" });
    expect(res).toEqual({ success: true });
  });

  it("DRAFT 状态成功驳回（status === DRAFT + rejectReason undefined 走 ?? null）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await rejectLossOrder(1, { auditorId: 1, tenantId: "t1" });
    expect(res).toEqual({ success: true });
  });
});
