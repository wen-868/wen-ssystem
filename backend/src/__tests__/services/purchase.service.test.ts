import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  makeBizNo: vi.fn(),
  submitApproval: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));
vi.mock("../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));
vi.mock("../../services/admin/approval-records.service", () => ({ submitApproval: mocks.submitApproval }));

import { purchaseService } from "../../services/purchase.service";

const ctx = { tenantId: "t1", userId: 1, username: "tester" } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("CGDD-TEST");
  mocks.query.mockResolvedValue([]);
  mocks.queryOne.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (fn: any) => fn({ query: vi.fn() }));
  mocks.connExecute.mockImplementation(async (_conn: any, sql: string) => {
    if (String(sql).includes("SELECT total_bottle_qty")) return [[{ total_bottle_qty: 10, in_stocked_qty: 10 }], []];
    return [{ insertId: 1, affectedRows: 1 }, []];
  });
});

describe("purchase.service - 列表/详情", () => {
  it("getPageList 带关键词/供应商/状态筛选", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 2 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, orderNo: "CGDD1" }]);
    const res = await purchaseService.getPageList("茅台", 5, "DRAFT", undefined, undefined, 1, 20, ctx);
    expect(res.total).toBe(2);
    expect(res.records[0].orderNo).toBe("CGDD1");
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("order_no LIKE ?");
    expect(sql).toContain("supplier_id = ?");
    expect(sql).toContain("order_status = ?");
  });

  it("getPageList 无筛选仅租户条件", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await purchaseService.getPageList(undefined, undefined, undefined, undefined, undefined, 1, 20, ctx);
    expect(res.total).toBe(0);
    expect(String(mocks.queryOneWithTenant.mock.calls[0][0])).toContain("tenant_id = ?");
  });

  it("getDetail 存在 → 返回订单与明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, orderNo: "CGDD1", status: "DRAFT" });
    mocks.query.mockResolvedValueOnce([{ skuId: 1, skuName: "茅台" }]);
    const res = await purchaseService.getDetail("CGDD1", ctx);
    expect(res?.orderNo).toBe("CGDD1");
    expect(res?.items[0].skuName).toBe("茅台");
  });

  it("getDetail 不存在 → null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await purchaseService.getDetail("NOPE", ctx)).toBeNull();
  });
});

describe("purchase.service - 创建/修改/删除", () => {
  const item = { skuId: 1, skuName: "茅台", boxQty: 1, bottleQty: 0, unitPrice: 10, taxRate: 0.1 };

  it("createOrder 计算金额并落库", async () => {
    const res = await purchaseService.createOrder({ supplierId: 5, supplierName: "S", storeId: 2, items: [item] }, ctx);
    expect(res.purchaseNo).toBe("CGDD-TEST");
    expect(mocks.makeBizNo).toHaveBeenCalledWith("CGDD");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const orderInsert = mocks.connExecute.mock.calls.find((c) => String(c[1]).includes("INSERT INTO t_purchase_order ("))!;
    expect(orderInsert[2][4]).toBe(120); // goods_amount
    expect(orderInsert[2][8]).toBe(132); // payable_amount
  });

  it("updateOrder 草稿 → 更新成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    const res = await purchaseService.updateOrder("CGDD1", { remark: "改" }, ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("updateOrder 非草稿状态 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "APPROVED" });
    await expect(purchaseService.updateOrder("CGDD1", {}, ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("updateOrder 订单不存在 → null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await purchaseService.updateOrder("CGDD1", {}, ctx)).toBeNull();
  });

  it("delete 草稿 → 删除成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    const res = await purchaseService.delete("CGDD1", ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
  });

  it("delete 非草稿 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "APPROVED" });
    await expect(purchaseService.delete("CGDD1", ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("delete 不存在 → null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await purchaseService.delete("CGDD1", ctx)).toBeNull();
  });
});

describe("purchase.service - 提交/审核/取消/入库", () => {
  it("submit 草稿 → 发起审批并置 PENDING", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    mocks.submitApproval.mockResolvedValueOnce({ started: false, instanceNo: null });
    const res = await purchaseService.submit("CGDD1", ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
    expect(mocks.submitApproval).toHaveBeenCalled();
    expect(mocks.queryWithTenant.mock.calls.some((c) => String(c[0]).includes("UPDATE t_purchase_order SET order_status"))).toBe(true);
  });

  it("submit 非草稿 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "APPROVED" });
    await expect(purchaseService.submit("CGDD1", ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("approve 待审 → APPROVED", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "PENDING" });
    const res = await purchaseService.approve("CGDD1", ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
    const upd = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("order_status = ?"))!;
    expect(upd[1][0]).toBe("APPROVED");
  });

  it("approve 非待审 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    await expect(purchaseService.approve("CGDD1", ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("cancel 草稿或待审 → CANCELLED", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "PENDING" });
    const res = await purchaseService.cancel("CGDD1", ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
    const upd = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("order_status = ?"))!;
    expect(upd[1][0]).toBe("CANCELLED");
  });

  it("cancel 状态不允许 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "APPROVED" });
    await expect(purchaseService.cancel("CGDD1", ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("inStock 已审核 → 入库并置 FULL", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "APPROVED", storeId: 5 });
    mocks.query.mockResolvedValueOnce([{ sku_id: 1, in_stocked_qty: 0 }]);
    const res = await purchaseService.inStock("CGDD1", { items: [{ skuId: 1, boxQty: 1, bottleQty: 0 }] }, ctx);
    expect(res?.purchaseNo).toBe("CGDD1");
    const wh = mocks.connExecute.mock.calls.find((c) => String(c[1]).includes("warehouse_status"))!;
    expect(wh[2][0]).toBe("FULL");
  });

  it("inStock 非已审核 → 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT", storeId: 5 });
    await expect(purchaseService.inStock("CGDD1", { items: [] }, ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("inStock 不存在 → null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await purchaseService.inStock("CGDD1", { items: [] }, ctx)).toBeNull();
  });
});
