import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));
vi.mock("../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

import {
  listTransferOrders,
  getTransferStatistics,
  getTransferOrderDetail,
  createTransferOrder,
  updateTransferOrder,
  getTransferTrend,
  submitTransferOrder,
  approveTransferOrder,
  rejectTransferOrder,
} from "../../services/transfer-order.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("DB-TEST");
  mocks.transaction.mockImplementation(async (fn: any) => fn({ query: vi.fn() }));
  mocks.connExecute.mockImplementation(async () => [{ insertId: 1 }, []]);
});

describe("transfer-order.service - 调拨单", () => {
  it("listTransferOrders 全量分页查询", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, order_no: "DB1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listTransferOrders({ tenantId, page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.records[0].order_no).toBe("DB1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("LEFT JOIN t_store");
  });

  it("listTransferOrders 带状态/门店/日期筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listTransferOrders({ tenantId, page: 1, pageSize: 10, status: "TRANSIT", storeId: 2, dateStart: "2026-08-01", dateEnd: "2026-08-10" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("to_.status = ?");
    expect(sql).toContain("from_store_id = ? OR to_.to_store_id = ?");
    expect(sql).toContain("to_.created_at >= ?");
    expect(sql).toContain("to_.created_at <= ?");
    const values = mocks.queryWithTenant.mock.calls[0][1];
    expect(values).toContain("2026-08-10 23:59:59");
  });

  it("getTransferStatistics 返回三项统计", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 5 })
      .mockResolvedValueOnce({ total: 2 })
      .mockResolvedValueOnce({ total: 3 });
    const stats = await getTransferStatistics(tenantId);
    expect(stats).toEqual({ monthTotal: 5, transitCount: 2, receivedCount: 3 });
  });

  it("getTransferOrderDetail 存在时返回订单与明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, order_no: "DB1" });
    mocks.queryWithTenant.mockResolvedValue([{ sku_id: 1, qty: 10 }]);
    const detail = await getTransferOrderDetail(1, tenantId);
    expect(detail.order_no).toBe("DB1");
    expect(detail.items).toHaveLength(1);
  });

  it("getTransferOrderDetail 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getTransferOrderDetail(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "调拨单不存在" });
  });
});

// ===== Batch 5 扩展：创建/更新/趋势/提交/审批/拒绝 =====
describe("transfer-order.service - 创建", () => {
  it("createTransferOrder 计算金额并落库", async () => {
    const res = await createTransferOrder({ tenantId, userId: 1, fromStoreId: 2, toStoreId: 3, remark: "调拨", items: [{ skuId: 1, skuName: "茅台", quantity: 2, unitPrice: 10 }] });
    expect(res.transferNo).toBe("DB-TEST");
    expect(mocks.makeBizNo).toHaveBeenCalledWith("DB");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const orderInsert = mocks.connExecute.mock.calls.find((c) => String(c[1]).includes("INSERT INTO t_transfer_order ("))!;
    expect(orderInsert[2][4]).toBe(20); // total_amount
  });

  it("createTransferOrder 同门店 → 抛错", async () => {
    await expect(createTransferOrder({ tenantId, userId: 1, fromStoreId: 2, toStoreId: 2, remark: "x", items: [{ skuId: 1, skuName: "a", quantity: 1, unitPrice: 1 }] }))
      .rejects.toThrow("调出门店和调入门店不能相同");
  });
});

describe("transfer-order.service - 更新", () => {
  it("updateTransferOrder 草稿 → 更新成功", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "DRAFT" }], []]);
    const res = await updateTransferOrder(1, tenantId, { remark: "改", items: [{ skuId: 1, skuName: "茅台", quantity: 1, unitPrice: 5 }] });
    expect(res.transferOrderId).toBe(1);
  });

  it("updateTransferOrder 非草稿 → 抛错", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "TRANSIT" }], []]);
    await expect(updateTransferOrder(1, tenantId, { remark: "x" })).rejects.toThrow("仅草稿状态可编辑");
  });

  it("updateTransferOrder 不存在 → 抛错", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[], []]);
    await expect(updateTransferOrder(1, tenantId, { remark: "x" })).rejects.toThrow("调拨单不存在");
  });
});

describe("transfer-order.service - 趋势", () => {
  it("getTransferTrend 返回日期统计", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ date: "2026-08-16", count: 2 }]);
    const res = await getTransferTrend(tenantId, 7);
    expect(res[0]).toEqual({ date: "2026-08-16", count: 2 });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DATE_SUB(CURDATE()");
  });
});

describe("transfer-order.service - 状态流转", () => {
  it("submitTransferOrder 草稿 → PENDING", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "DRAFT" }], []]);
    const res = await submitTransferOrder(1, tenantId);
    expect(res.transferOrderId).toBe(1);
    expect(String(mocks.connExecute.mock.calls[1][1])).toContain("PENDING");
  });

  it("submitTransferOrder 非草稿 → 抛错", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "APPROVED" }], []]);
    await expect(submitTransferOrder(1, tenantId)).rejects.toThrow("仅草稿状态可提交");
  });

  it("approveTransferOrder 待审 → APPROVED", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "PENDING" }], []]);
    const res = await approveTransferOrder(1, tenantId, 9);
    expect(res.transferOrderId).toBe(1);
    expect(String(mocks.connExecute.mock.calls[1][1])).toContain("APPROVED");
  });

  it("approveTransferOrder 非待审 → 抛错", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "DRAFT" }], []]);
    await expect(approveTransferOrder(1, tenantId, 9)).rejects.toThrow("仅待审核状态可审批");
  });

  it("rejectTransferOrder 待审 → DRAFT", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "PENDING" }], []]);
    const res = await rejectTransferOrder(1, tenantId);
    expect(res.transferOrderId).toBe(1);
    expect(String(mocks.connExecute.mock.calls[1][1])).toContain("DRAFT");
  });

  it("rejectTransferOrder 非待审 → 抛错", async () => {
    mocks.connExecute.mockImplementationOnce(async () => [[{ id: 1, status: "APPROVED" }], []]);
    await expect(rejectTransferOrder(1, tenantId)).rejects.toThrow("仅待审核状态可拒绝");
  });
});
