import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listInventory,
  adjustInventory,
  listInventoryLogs,
  listInventoryAlerts,
  updateAlertThreshold,
} from "../../../services/store/inventory.service";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
  mockConn.query.mockResolvedValue([[{ physicalQty: 100 }]]);
  mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
  mocks.makeBizNo.mockReturnValue("BIZ20260816001");
});

describe("inventory.service - listInventory", () => {
  it("无 storeId 时返回库存数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "茅台" }]);
    const res = await listInventory({ keyword: "茅台", storeId: null, tenantId: "t1" });
    expect(res).toHaveLength(1);
    expect(mocks.queryWithTenant).toHaveBeenCalled();
  });

  it("有 storeId 时带入 storeId 过滤参数", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await listInventory({ keyword: "", storeId: 5, tenantId: "t1" });
    const args = mocks.queryWithTenant.mock.calls[0];
    expect((args[1] as unknown[])[1]).toBe(5); // storeId 绑定到 ? IS NULL OR ib.store_id = ?
  });
});

describe("inventory.service - adjustInventory", () => {
  it("成功调整：FOR UPDATE 查询 + 两次 execute + 生成业务号", async () => {
    const res = await adjustInventory({
      storeId: 1, skuId: 1, stockType: "OFFLINE", change: 5, userId: 10, tenantId: "t1",
    });
    expect(res).toEqual({ ok: true });
    expect(mockConn.query).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [1, 1, "OFFLINE", "t1"]
    );
    expect(mockConn.execute).toHaveBeenCalledTimes(2);
    expect(mocks.makeBizNo).toHaveBeenCalledWith("IL");
  });

  it("查询无记录时 beforeQty 归零（?? 0 分支）", async () => {
    mockConn.query.mockResolvedValue([[]]);
    const res = await adjustInventory({
      storeId: 1, skuId: 1, stockType: "ONLINE", change: -3, userId: 10, tenantId: "t1",
    });
    expect(res).toEqual({ ok: true });
  });
});

describe("inventory.service - listInventoryLogs", () => {
  it("有 storeId 时追加 store 过滤与总数", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ logNo: "L1" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 5 });
    const res = await listInventoryLogs({ page: 1, pageSize: 10, storeId: 1, tenantId: "t1" });
    expect(res.records).toHaveLength(1);
    expect(res.total).toBe(5);
    expect((mocks.queryWithTenant.mock.calls[0][0] as string)).toContain("il.store_id = ?");
  });

  it("storeId 为 null 时不追加 store 过滤", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
    const res = await listInventoryLogs({ page: 1, pageSize: 10, storeId: null, tenantId: "t1" });
    expect(res.total).toBe(0);
    expect((mocks.queryWithTenant.mock.calls[0][0] as string)).not.toContain("il.store_id = ?");
  });
});

describe("inventory.service - listInventoryAlerts", () => {
  it("有 storeId 时过滤门店", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1 }]);
    const res = await listInventoryAlerts(9, "t1");
    expect(res).toHaveLength(1);
    expect((mocks.queryWithTenant.mock.calls[0][0] as string)).toContain("ib.store_id = ?");
  });

  it("storeId 为 null 时查询全部门店预警", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await listInventoryAlerts(null, "t1");
    expect((mocks.queryWithTenant.mock.calls[0][0] as string)).not.toContain("ib.store_id = ?");
  });
});

describe("inventory.service - updateAlertThreshold", () => {
  it("合法阈值 → 更新成功并返回 {skuId, threshold}", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 } as any);
    const res = await updateAlertThreshold(1, 10, "t1");
    expect(res).toEqual({ skuId: 1, threshold: 10 });
  });

  it("负阈值 → 抛 400", async () => {
    await expect(updateAlertThreshold(1, -1, "t1"))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("非数字阈值 → 抛 400", async () => {
    await expect(updateAlertThreshold(1, NaN, "t1"))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("更新 0 行（SKU 不存在）→ 抛 404", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 } as any);
    await expect(updateAlertThreshold(1, 10, "t1"))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
