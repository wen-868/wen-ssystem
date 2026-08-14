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
  listGroupBuyActivities,
  getGroupBuyActivity,
  startGroupBuy,
  joinGroupBuy,
} from "../../../services/marketing/community-marketing.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
});

describe("community-marketing.service - 拼团列表", () => {
  it("无筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "拼团A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listGroupBuyActivities(tenantId, 1, 10);
    expect(res.total).toBe(1);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listGroupBuyActivities(tenantId, 1, 10, "ACTIVE");
    expect(res.total).toBe(0);
  });

  it("total 为 null 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res: any = await listGroupBuyActivities(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });

  it("分页参数正确 - 第二页", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 25 });
    const res: any = await listGroupBuyActivities(tenantId, 3, 10);
    expect(res.page).toBe(3);
    expect(res.pageSize).toBe(10);
    expect(res.total).toBe(25);
  });

  it("空列表应返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listGroupBuyActivities(tenantId, 1, 10);
    expect(res.records).toEqual([]);
    expect(res.total).toBe(0);
  });
});

describe("community-marketing.service - 拼团详情", () => {
  it("活动存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "拼团A" });
    const res: any = await getGroupBuyActivity(tenantId, 1);
    expect(res.id).toBe(1);
  });

  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getGroupBuyActivity(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在" });
  });

  it("返回完整活动信息", async () => {
    const mockActivity = {
      id: 1,
      name: "拼团A",
      groupPrice: 88,
      originalPrice: 100,
      minGroupSize: 2,
      maxGroupSize: 5,
      status: "ACTIVE",
    };
    mocks.queryOneWithTenant.mockResolvedValue(mockActivity);
    const res: any = await getGroupBuyActivity(tenantId, 1);
    expect(res.name).toBe("拼团A");
    expect(res.status).toBe("ACTIVE");
  });
});

describe("community-marketing.service - 发起拼团", () => {
  it("活动不存在抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(startGroupBuy(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在或已结束" });
  });

  it("活动已结束抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(startGroupBuy(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在或已结束" });
  });

  it("库存不足抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, total_stock: 10, sold_count: 10, time_limit_hours: 24, min_group_size: 2,
    }]]);
    await expect(startGroupBuy(tenantId, 1, 1, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "拼团库存不足" });
  });

  it("库存刚好等于购买数量 - 应成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, name: "拼团A", group_price: 88, min_group_size: 2, max_group_size: 5,
        time_limit_hours: 24, total_stock: 5, sold_count: 3, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentSize: 1 }]]);
    const res: any = await startGroupBuy(tenantId, 1, 10, 2);
    expect(res.id).toBe(100);
  });

  it("剩余库存小于购买数量 - 应失败", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, total_stock: 10, sold_count: 9, time_limit_hours: 24, min_group_size: 2,
    }]]);
    await expect(startGroupBuy(tenantId, 1, 1, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "拼团库存不足" });
  });

  it("发起拼团成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, name: "拼团A", group_price: 88, min_group_size: 2, max_group_size: 5,
        time_limit_hours: 24, total_stock: 100, sold_count: 10, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentSize: 1 }]]);
    const res: any = await startGroupBuy(tenantId, 1, 10, 1);
    expect(res.id).toBe(100);
  });

  it("默认 quantity 为 1", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, name: "拼团A", group_price: 88, min_group_size: 2, max_group_size: 5,
        time_limit_hours: 24, total_stock: 100, sold_count: 10, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentSize: 1 }]]);
    const res: any = await startGroupBuy(tenantId, 1, 10);
    expect(res.id).toBe(100);
    // 验证 sold_count + 1
    const updateSoldCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("UPDATE t_group_buy SET sold_count")
    );
    expect(updateSoldCall).toBeTruthy();
    expect(updateSoldCall[1][0]).toBe(1);
  });
});

describe("community-marketing.service - 参团", () => {
  it("拼团组不存在抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[]]);
    await expect(joinGroupBuy(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团组不存在或已结束" });
  });

  it("拼团组已过期抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[]]);
    await expect(joinGroupBuy(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团组不存在或已结束" });
  });

  it("已参与该团抛错", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 1, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[{ id: 1 }]]);
    await expect(joinGroupBuy(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 400, message: "您已参与该团" });
  });

  it("团已满员抛错", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 3, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[]]);
    await expect(joinGroupBuy(tenantId, 1, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "该团已满员" });
  });

  it("参团库存不足抛错", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 1, target_size: 3, status: "PENDING",
        total_stock: 10, sold_count: 9,
      }]])
      .mockResolvedValueOnce([[]]);
    await expect(joinGroupBuy(tenantId, 1, 2, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "拼团库存不足" });
  });

  it("参团成功（未成团）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 1, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", activityName: "拼团A" });
    const res: any = await joinGroupBuy(tenantId, 1, 2, 1);
    expect(res.message).toBe("参团成功");
  });

  it("参团成功（成团）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 2, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "COMPLETED", activityName: "拼团A" });
    const res: any = await joinGroupBuy(tenantId, 1, 3, 1);
    expect(res.message).toBe("拼团成功");
  });

  it("参团后刚好成团 - 状态应为 COMPLETED", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 2, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "COMPLETED", activityName: "拼团A" });
    await joinGroupBuy(tenantId, 1, 3, 1);
    // 验证状态更新为 COMPLETED
    const updateTeamCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("UPDATE t_group_buy_team")
    );
    expect(updateTeamCall).toBeTruthy();
    expect(updateTeamCall[1][1]).toBe("COMPLETED");
  });

  it("默认参团数量为 1", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_id: 1, current_size: 1, target_size: 3, status: "PENDING",
        total_stock: 100, sold_count: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", activityName: "拼团A" });
    const res: any = await joinGroupBuy(tenantId, 1, 2);
    expect(res.message).toBe("参团成功");
  });
});
