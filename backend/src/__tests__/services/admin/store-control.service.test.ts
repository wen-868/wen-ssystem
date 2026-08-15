import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

import { getConfigs, getConfig, upsertConfig } from "../../../services/admin/store-control.service";

describe("admin/store-control.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getConfigs：返回门店管控配置列表", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1, store_id: 1, store_name: "总仓" }]);
    const result = await getConfigs("t1");
    expect(result[0].store_name).toBe("总仓");
  });

  it("getConfig：返回单门店配置", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, store_id: 1, store_status: 1 });
    const config = await getConfig(1, "t1");
    expect(config?.store_id).toBe(1);
  });

  it("upsertConfig：更新或创建门店管控配置", async () => {
    const conn = { execute: vi.fn() };
    conn.execute
      .mockResolvedValueOnce([[]]) // 无现有配置 → INSERT
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    await upsertConfig({ storeId: 1, tenantId: "t1", maxDailyOrders: 100 });
    const insertCalls = conn.execute.mock.calls;
    expect(String(insertCalls[insertCalls.length - 1][0])).toContain("INSERT INTO t_store_control_config");
  });
});
