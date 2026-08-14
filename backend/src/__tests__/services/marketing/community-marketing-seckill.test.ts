import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  listSeckillActivities,
  getSeckillActivity,
  buySeckill,
  paySeckillOrder,
  cancelSeckillOrder,
} from "../../../services/marketing/community-marketing.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
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

  it("分页参数正确 - 第二页", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 25 });
    const res: any = await listSeckillActivities(tenantId, 3, 10);
    expect(res.page).toBe(3);
    expect(res.pageSize).toBe(10);
    expect(res.total).toBe(25);
  });

  it("空列表应返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listSeckillActivities(tenantId, 1, 10);
    expect(res.records).toEqual([]);
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

  it("返回完整活动信息", async () => {
    const mockActivity = {
      id: 1,
      productId: 100,
      seckillPrice: 88,
      originalPrice: 100,
      seckillStock: 100,
      availableStock: 50,
      limitPerUser: 2,
      status: "ACTIVE",
      productName: "秒杀商品A",
    };
    mocks.queryOneWithTenant.mockResolvedValue(mockActivity);
    const res: any = await getSeckillActivity(tenantId, 1);
    expect(res.productName).toBe("秒杀商品A");
    expect(res.status).toBe("ACTIVE");
  });
});

describe("community-marketing.service - 秒杀下单", () => {
  it("活动不存在抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(buySeckill(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "秒杀活动不存在或已结束" });
  });

  it("活动已结束抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(buySeckill(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "秒杀活动不存在或已结束" });
  });

  it("库存不足抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, available_stock: 0, seckill_stock: 100, limit_per_user: 1,
    }]]);
    await expect(buySeckill(tenantId, 1, 1, 1))
      .rejects.toMatchObject({ statusCode: 400, message: "秒杀库存不足" });
  });

  it("库存刚好等于数量 - 应成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 3, limit_per_user: 5, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 3);
    expect(res.orderNo).toMatch(/^MK/);
    expect(res.totalAmount).toBe(264);
  });

  it("超过限购数量抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, available_stock: 100, seckill_stock: 100, limit_per_user: 2,
    }]]);
    await expect(buySeckill(tenantId, 1, 1, 3))
      .rejects.toMatchObject({ statusCode: 400, message: "每人限购2件" });
  });

  it("刚好等于限购数量 - 应成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 2);
    expect(res.orderNo).toMatch(/^MK/);
    expect(res.quantity).toBe(2);
  });

  it("limit_per_user 为 0 时默认限购 1 件", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 0, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 1);
    expect(res.orderNo).toMatch(/^MK/);
  });

  it("limit_per_user 为 null 时默认限购 1 件", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: null, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 1);
    expect(res.orderNo).toMatch(/^MK/);
  });

  it("秒杀下单成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 1);
    expect(res.orderNo).toMatch(/^MK/);
    expect(res.totalAmount).toBe(88);
  });

  it("订单号格式应为 MK + 日期8位 + 5位随机", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 1);
    // 订单号以MK开头，后面跟着数字
    expect(res.orderNo).toMatch(/^MK\d+$/);
    expect(res.orderNo.length).toBeGreaterThanOrEqual(13); // MK + 8位日期 + 5位随机
  });

  it("默认购买数量为 1", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1);
    expect(res.quantity).toBe(1);
    expect(res.totalAmount).toBe(88);
  });

  it("总金额计算正确 - 多件商品", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 29.9, seckill_stock: 100,
        available_stock: 50, limit_per_user: 5, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    const res: any = await buySeckill(tenantId, 1, 1, 3);
    expect(res.totalAmount).toBeCloseTo(89.7, 5);
  });

  it("下单后应扣减库存", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, product_id: 100, seckill_price: 88, seckill_stock: 100,
        available_stock: 50, limit_per_user: 2, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([[{ totalQty: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ name: '张三', mobile: '13800000000' });
    await buySeckill(tenantId, 1, 1, 2);
    // 验证库存扣减
    const updateStockCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("UPDATE t_seckill_product SET available_stock")
    );
    expect(updateStockCall).toBeTruthy();
    expect(updateStockCall[1][0]).toBe(2);
  });
});

describe("community-marketing.service - 秒杀订单支付/取消", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
    mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
  });

  it("支付确认：PENDING_PAY → PAID", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, order_no: "MK2026081500001", activity_id: 1, quantity: 1, status: "PENDING_PAY", member_id: 9,
    });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await paySeckillOrder(tenantId, "MK2026081500001", 9);
    expect(res).toEqual({ orderNo: "MK2026081500001", status: "PAID" });
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_seckill_order SET status = 'PAID'"),
      ["MK2026081500001", tenantId],
      tenantId
    );
  });

  it("支付确认幂等：已 PAID 直接返回成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, order_no: "MK2026081500001", activity_id: 1, quantity: 1, status: "PAID", member_id: 9,
    });
    const res = await paySeckillOrder(tenantId, "MK2026081500001", 9);
    expect(res.status).toBe("PAID");
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("支付他人订单抛 403", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, order_no: "MK2026081500001", activity_id: 1, quantity: 1, status: "PENDING_PAY", member_id: 9,
    });
    await expect(paySeckillOrder(tenantId, "MK2026081500001", 99))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("取消订单：PENDING_PAY → CANCELLED 并回补库存", async () => {
    mockConn.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, order_no: "MK2026081500001", activity_id: 1, quantity: 2, status: "PENDING_PAY", member_id: 9,
    });
    const res = await cancelSeckillOrder(tenantId, "MK2026081500001", 9, "用户取消");
    expect(res).toEqual({ orderNo: "MK2026081500001", status: "CANCELLED" });
    const updateOrderCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("UPDATE t_seckill_order SET status = 'CANCELLED'")
    );
    const restoreStockCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("UPDATE t_seckill_product SET available_stock = available_stock +")
    );
    expect(updateOrderCall).toBeTruthy();
    expect(restoreStockCall).toBeTruthy();
    expect(restoreStockCall[1][0]).toBe(2);
  });

  it("已支付订单不可取消", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, order_no: "MK2026081500001", activity_id: 1, quantity: 1, status: "PAID", member_id: 9,
    });
    await expect(cancelSeckillOrder(tenantId, "MK2026081500001", 9))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
