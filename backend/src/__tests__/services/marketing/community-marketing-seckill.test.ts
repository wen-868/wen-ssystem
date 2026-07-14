import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  listSeckillActivities,
  getSeckillActivity,
  buySeckill,
} from "../../../services/marketing/community-marketing.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("community-marketing.service - 秒杀列表", () => {
  it("无筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, productName: "秒杀A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listSeckillActivities(tenantId, 1, 10);
    expect(res.total).toBe(1);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listSeckillActivities(tenantId, 1, 10, "ACTIVE");
    expect(res.total).toBe(0);
  });

  it("total 为 null 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res: any = await listSeckillActivities(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });
});

describe("community-marketing.service - 秒杀详情", () => {
  it("活动存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, productName: "秒杀A" });
    const res: any = await getSeckillActivity(tenantId, 1);
    expect(res.id).toBe(1);
  });

  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getSeckillActivity(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "秒杀活动不存在" });
  });
});

describe("community-marketing.service - 秒杀下单", () => {
  it("活动不存在抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(buySeckill(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "秒杀活动不存在或已结束" });
  });

  it("库存不足抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, available_stock: 0, seckill_stock: 100, limit_per_user: 1,
    }]]);
    await expect(buySeckill(tenantId, 1, 1, 1))
      .rejects.toMatchObject({ statusCode: 400, message: "秒杀库存不足" });
  });

  it("超过限购数量抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, available_stock: 100, seckill_stock: 100, limit_per_user: 2,
    }]]);
    await expect(buySeckill(tenantId, 1, 1, 3))
      .rejects.toMatchObject({ statusCode: 400, message: "每人限购2件" });
  });

  it("秒杀下单成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await buySeckill(tenantId, 1, 1, 1);
    expect(res.orderNo).toMatch(/^SK/);
    expect(res.totalAmount).toBe(88);
  });
});
