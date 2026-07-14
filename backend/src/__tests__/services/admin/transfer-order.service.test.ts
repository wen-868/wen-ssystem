/**
 * 调拨单 service 单元测试
 * 被测文件：src/services/admin/transfer-order.service.ts
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
  createTransferOrder,
  listTransferOrders,
  getTransferOrderDetail,
  updateTransferOrder,
  deleteTransferOrder,
  submitTransferOrder,
  approveTransferOrder,
  rejectTransferOrder,
  confirmTransferOut,
  confirmTransferIn,
  getTransferStats,
} from "../../../services/admin/transfer-order.service";

const mockConn = { execute: vi.fn(), query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("DB20260715000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

const sampleItems = [
  { skuId: 1, skuName: "商品A", quantity: 10, unitPrice: 50 },
  { skuId: 2, skuName: "商品B", quantity: 5, unitPrice: 20 },
];

// ========== createTransferOrder ==========
describe("transfer-order.service - createTransferOrder", () => {
  it("调出门店和调入门店相同时抛 400", async () => {
    await expect(createTransferOrder({
      tenantId: "t1", userId: 1, fromStoreId: 1, toStoreId: 1, items: sampleItems,
    })).rejects.toMatchObject({ statusCode: 400, message: "调出门店和调入门店不能相同" });
  });

  it("明细为空时抛 400", async () => {
    await expect(createTransferOrder({
      tenantId: "t1", userId: 1, fromStoreId: 1, toStoreId: 2, items: [],
    })).rejects.toMatchObject({ statusCode: 400, message: "调拨单明细不能为空" });
  });

  it("成功创建调拨单（完整字段）", async () => {
    mockConn.execute.mockResolvedValueOnce([{ insertId: 100 }]);
    const res = await createTransferOrder({
      tenantId: "t1",
      userId: 1,
      userName: "张三",
      fromStoreId: 1,
      fromStoreName: "总店",
      toStoreId: 2,
      toStoreName: "分店",
      expectedDate: "2026-07-20",
      remark: "测试调拨",
      items: sampleItems,
    });
    expect(res.id).toBe(100);
    expect(res.transferNo).toBe("DB20260715000001");
    expect(mockConn.execute).toHaveBeenCalledTimes(3); // 1次INSERT主表 + 2次INSERT明细
  });
});

// ========== listTransferOrders ==========
describe("transfer-order.service - listTransferOrders", () => {
  it("无可选筛选条件时只带 tenant_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, transferNo: "DB001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listTransferOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, transferNo: "DB001" }] });
  });

  it("传入全部筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listTransferOrders({
      page: 2, pageSize: 5, tenantId: "t1",
      status: "PENDING", fromStoreId: 1, toStoreId: 2, storeId: 3,
      dateStart: "2026-01-01", dateEnd: "2026-12-31", keyword: "测试",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null 时 total 兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listTransferOrders({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ========== getTransferOrderDetail ==========
describe("transfer-order.service - getTransferOrderDetail", () => {
  it("调拨单存在时返回详情及明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, transferNo: "DB001", status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([{ id: 10, skuId: 1, quantity: 5 }]);
    const res = await getTransferOrderDetail(1, "t1");
    expect(res.id).toBe(1);
    expect(res.items.length).toBe(1);
  });

  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getTransferOrderDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "调拨单不存在" });
  });
});

// ========== updateTransferOrder ==========
describe("transfer-order.service - updateTransferOrder", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateTransferOrder(99, "t1", { remark: "test" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非草稿状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(updateTransferOrder(1, "t1", { remark: "test" })).rejects.toMatchObject({ statusCode: 400, message: "仅草稿状态可编辑" });
  });

  it("只更新基本字段（不传items）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateTransferOrder(1, "t1", { expectedDate: "2026-07-20", remark: "测试" });
    expect(res.id).toBe(1);
    expect(mockConn.execute).toHaveBeenCalledTimes(1);
  });

  it("更新明细（传items）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateTransferOrder(1, "t1", {
      items: [{ skuId: 1, skuName: "商品A", quantity: 20, unitPrice: 60 }],
    });
    expect(res.id).toBe(1);
    expect(mockConn.execute).toHaveBeenCalledTimes(3); // DELETE + INSERT + UPDATE主表
  });

  it("无更新字段时不执行SQL", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    const res = await updateTransferOrder(1, "t1", {});
    expect(res.id).toBe(1);
    expect(mockConn.execute).not.toHaveBeenCalled();
  });
});

// ========== deleteTransferOrder ==========
describe("transfer-order.service - deleteTransferOrder", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteTransferOrder(99, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非草稿/已取消状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(deleteTransferOrder(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "仅草稿或已取消状态可删除" });
  });

  it("草稿状态删除成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteTransferOrder(1, "t1");
    expect(res.success).toBe(true);
    expect(mockConn.execute).toHaveBeenCalledTimes(2); // DELETE明细 + DELETE主表
  });

  it("已取消状态删除成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CANCELLED" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteTransferOrder(1, "t1");
    expect(res.success).toBe(true);
  });
});

// ========== submitTransferOrder ==========
describe("transfer-order.service - submitTransferOrder", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(submitTransferOrder(99, "t1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非草稿状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(submitTransferOrder(1, "t1")).rejects.toMatchObject({ statusCode: 400, message: "仅草稿状态可提交审核" });
  });

  it("草稿状态提交成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await submitTransferOrder(1, "t1");
    expect(res.id).toBe(1);
  });
});

// ========== approveTransferOrder ==========
describe("transfer-order.service - approveTransferOrder", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(approveTransferOrder(99, "t1", { approverId: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非待审核状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    await expect(approveTransferOrder(1, "t1", { approverId: 1 })).rejects.toMatchObject({ statusCode: 400, message: "仅待审核状态可审核通过" });
  });

  it("待审核状态审核通过成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await approveTransferOrder(1, "t1", { approverId: 1, approverName: "审核员" });
    expect(res.id).toBe(1);
  });
});

// ========== rejectTransferOrder ==========
describe("transfer-order.service - rejectTransferOrder", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(rejectTransferOrder(99, "t1", { approverId: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非待审核状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    await expect(rejectTransferOrder(1, "t1", { approverId: 1 })).rejects.toMatchObject({ statusCode: 400, message: "仅待审核状态可驳回" });
  });

  it("待审核状态驳回成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await rejectTransferOrder(1, "t1", { approverId: 1, approverName: "审核员", rejectReason: "商品不对" });
    expect(res.id).toBe(1);
  });
});

// ========== confirmTransferOut ==========
describe("transfer-order.service - confirmTransferOut", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(confirmTransferOut(99, "t1", { operatorId: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非已审核状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", fromStoreId: 1, transferNo: "DB001" });
    await expect(confirmTransferOut(1, "t1", { operatorId: 1 })).rejects.toMatchObject({ statusCode: 400, message: "仅已审核状态可确认出库" });
  });

  it("已审核状态确认出库成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED", fromStoreId: 1, transferNo: "DB001" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockConn.query.mockResolvedValue([{ skuId: 1, quantity: 10 }]);
    const res = await confirmTransferOut(1, "t1", { operatorId: 1, operatorName: "库管员" });
    expect(res.id).toBe(1);
    expect(mockConn.execute).toHaveBeenCalled();
  });
});

// ========== confirmTransferIn ==========
describe("transfer-order.service - confirmTransferIn", () => {
  it("调拨单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(confirmTransferIn(99, "t1", { operatorId: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("非运输中状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED", toStoreId: 2, transferNo: "DB001" });
    await expect(confirmTransferIn(1, "t1", { operatorId: 1 })).rejects.toMatchObject({ statusCode: 400, message: "仅运输中状态可确认入库" });
  });

  it("运输中状态确认入库成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "TRANSIT", toStoreId: 2, transferNo: "DB001" });
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockConn.query.mockResolvedValue([{ skuId: 1, quantity: 10, unitPrice: 50 }]);
    const res = await confirmTransferIn(1, "t1", { operatorId: 1, operatorName: "库管员" });
    expect(res.id).toBe(1);
    expect(mockConn.execute).toHaveBeenCalled();
  });
});

// ========== getTransferStats ==========
describe("transfer-order.service - getTransferStats", () => {
  it("正常返回统计数据", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 10 }) // monthTotal
    mocks.queryWithTenant.mockResolvedValue([
      { status: "DRAFT", count: 1 },
      { status: "PENDING", count: 2 },
      { status: "TRANSIT", count: 3 },
      { status: "RECEIVED", count: 4 },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ amount: 5000 }); // monthAmount

    const res = await getTransferStats("t1");
    expect(res.monthTotal).toBe(10);
    expect(res.draftCount).toBe(1);
    expect(res.pendingCount).toBe(2);
    expect(res.transitCount).toBe(3);
    expect(res.receivedCount).toBe(4);
  });

  it("无数据时各状态为 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // monthTotal
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // monthAmount

    const res = await getTransferStats("t1");
    expect(res.monthTotal).toBe(0);
    expect(res.monthAmount).toBe(0);
    expect(res.draftCount).toBe(0);
    expect(res.pendingCount).toBe(0);
    expect(res.approvedCount).toBe(0);
    expect(res.transitCount).toBe(0);
    expect(res.receivedCount).toBe(0);
    expect(res.rejectedCount).toBe(0);
    expect(res.cancelledCount).toBe(0);
  });
});
