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

import { listBatches, getBatchDetail, getFifoSuggestion } from "../../../services/admin/inventory-batch.service";

describe("admin/inventory-batch.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listBatches：分页批次列表（含效期状态）", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1, sku_name: "酒", expiry_date: "2026-08-01", days_remaining: -5 }]);
    mocks.queryOne.mockResolvedValueOnce({ total: 1 });
    const result = await listBatches("t1", { page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.records[0].expiryStatusText).toBe("已过期");
  });

  it("getBatchDetail：返回批次详情", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, sku_name: "酒" });
    const detail = await getBatchDetail("t1", 1);
    expect(detail?.sku_name).toBe("酒");
  });

  it("getFifoSuggestion：返回 FIFO 出库建议", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: 1, batch_no: "PC001", quantity: 10, expiry_date: "2026-12-01" },
    ]);
    const result = await getFifoSuggestion("t1", 1, 10);
    expect(result).toHaveLength(1);
    expect(result[0].batch_no).toBe("PC001");
  });
});
