﻿﻿﻿﻿﻿/**
 * 库存查询 service 单元测试
 * 被测文件：src/services/store/inventory.service.ts
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
  listInventory,
  adjustInventory,
  listInventoryLogs,
  listInventoryAlerts,
} from "../../../services/store/inventory.service";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("IL20260709000001");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

describe("inventory.service - listInventory", () => {
  it("storeId 有值（?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1 }]);
    const res = await listInventory({ keyword: "茅台", storeId: 1, tenantId: "t1" });
    expect(res).toHaveLength(1);
  });

  it("storeId 为 null（?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await listInventory({ keyword: "", storeId: null, tenantId: "t1" });
    expect(res).toEqual([]);
  });

  it("storeId 为 undefined（?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await listInventory({ keyword: "五粮液", storeId: undefined, tenantId: "t1" });
    expect(res).toEqual([]);
  });
});

describe("inventory.service - adjustInventory", () => {
  it("rows 有值 + userId/remark 有值（?. 左 + ?? 左）", async () => {
    mockConn.query.mockResolvedValue([[{ physicalQty: 10 }], undefined]);
    mockConn.execute.mockResolvedValue([]);
    const res = await adjustInventory({
      storeId: 1, skuId: 1, stockType: "OFFLINE", change: 5, remark: "调整", userId: 1, tenantId: "t1",
    });
    expect(res).toEqual({ ok: true });
  });

  it("rows 为空 + userId/remark 无值（?. 右 + ?? 右）", async () => {
    mockConn.query.mockResolvedValue([[], undefined]);
    mockConn.execute.mockResolvedValue([]);
    const res = await adjustInventory({
      storeId: 1, skuId: 2, stockType: "ONLINE", change: -3, userId: null as any, tenantId: "t1",
    } as any);
    expect(res).toEqual({ ok: true });
    // 验证 remark ?? "门店调整"（参数索引10）
    const ledgerCall = mockConn.execute.mock.calls[1];
    expect(ledgerCall[1][10]).toBe("门店调整");
    // 验证 userId ?? null（参数索引8）
    expect(ledgerCall[1][8]).toBeNull();
  });
});

describe("inventory.service - listInventoryLogs", () => {
  it("有 storeId + totalRow 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ logNo: "IL1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listInventoryLogs({ page: 1, pageSize: 10, storeId: 1, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ logNo: "IL1" }] });
  });

  it("无 storeId + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listInventoryLogs({ page: 1, pageSize: 10, storeId: null, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("inventory.service - listInventoryAlerts", () => {
  it("有 storeId", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, availableQty: 3 }]);
    const res = await listInventoryAlerts(1, "t1");
    expect(res).toHaveLength(1);
  });

  it("无 storeId", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await listInventoryAlerts(null, "t1");
    expect(res).toEqual([]);
  });
});
