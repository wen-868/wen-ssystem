import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  createFlashSale,
  listFlashSales,
  getFlashSale,
  getFlashSaleStatistics,
  listActiveFlashSales,
} from "../../../services/admin/marketing-flash-sale.service";

const tenantId = "t1";

function mockSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "秒杀A",
    productId: 10,
    skuId: 100,
    flashPrice: 88,
    originalPrice: 100,
    totalStock: 50,
    soldCount: 10,
    limitPerUser: 2,
    startTime: "2026-08-01",
    endTime: "2026-08-31",
    status: "ACTIVE",
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-flash-sale.service - 限时秒杀管理", () => {
  it("createFlashSale 插入后返回最新活动", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue(mockSale());
    const res = await createFlashSale({
      name: "秒杀A", productId: 10, skuId: 100, flashPrice: 88, originalPrice: 100,
      totalStock: 50, limitPerUser: 2, startTime: "2026-08-01", endTime: "2026-08-31",
    }, tenantId);
    expect(res.name).toBe("秒杀A");
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_flash_sale");
    expect(params[0]).toBe("秒杀A");
  });

  it("listFlashSales 带状态筛选分页", async () => {
    mocks.queryWithTenant.mockResolvedValue([mockSale()]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listFlashSales(1, 20, tenantId, "ACTIVE");
    expect(res.total).toBe(1);
    expect(res.records[0].flashPrice).toBe(88);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = ?");
  });

  it("getFlashSale 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getFlashSale(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it("getFlashSaleStatistics 计算售罄率", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, name: "秒杀A", flashPrice: 88, originalPrice: 100, totalStock: 50, soldCount: 10, orderCount: 8, totalQuantity: 10, totalAmount: 880, status: "ACTIVE" },
    ]);
    mocks.queryOneWithTenant.mockResolvedValue({ totalActivities: 1, totalStock: 50, totalSold: 10 });
    const stats = await getFlashSaleStatistics(tenantId);
    expect(stats.overall.totalActivities).toBe(1);
    expect(stats.overall.sellThroughRate).toBe("20.00%");
    expect(stats.details[0].sellThroughRate).toBe("20.00%");
  });

  it("listActiveFlashSales 查询进行中活动", async () => {
    mocks.queryWithTenant.mockResolvedValue([mockSale({ status: "ACTIVE" })]);
    const res = await listActiveFlashSales(tenantId);
    expect(res.total).toBe(1);
    expect(res.records[0].name).toBe("秒杀A");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("start_time <= ?");
  });
});
