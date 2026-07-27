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
  listBargainActivities,
  getBargainActivity,
  startBargain,
  helpBargain,
} from "../../../services/marketing/community-marketing.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
});

describe("community-marketing.service - 砍价列表", () => {
  it("无筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, activityName: "砍价A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listBargainActivities(tenantId, 1, 10);
    expect(res.total).toBe(1);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listBargainActivities(tenantId, 1, 10, "ACTIVE");
    expect(res.total).toBe(0);
  });

  it("total 为 null 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res: any = await listBargainActivities(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });

  it("分页参数正确 - 第三页", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 25 });
    const res: any = await listBargainActivities(tenantId, 3, 10);
    expect(res.page).toBe(3);
    expect(res.pageSize).toBe(10);
    expect(res.total).toBe(25);
  });

  it("空列表应返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res: any = await listBargainActivities(tenantId, 1, 10);
    expect(res.records).toEqual([]);
    expect(res.total).toBe(0);
  });
});

describe("community-marketing.service - 砍价详情", () => {
  it("活动存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, activityName: "砍价A" });
    const res: any = await getBargainActivity(tenantId, 1);
    expect(res.id).toBe(1);
  });

  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getBargainActivity(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "砍价活动不存在" });
  });

  it("返回完整活动信息", async () => {
    const mockActivity = {
      id: 1,
      activityName: "砍价A",
      originalPrice: 100,
      minPrice: 50,
      bargainTimes: 10,
      status: "ACTIVE",
    };
    mocks.queryOneWithTenant.mockResolvedValue(mockActivity);
    const res: any = await getBargainActivity(tenantId, 1);
    expect(res.activityName).toBe("砍价A");
    expect(res.status).toBe("ACTIVE");
  });
});

describe("community-marketing.service - 发起砍价", () => {
  it("活动不存在抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(startBargain(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "砍价活动不存在或已结束" });
  });

  it("活动已结束抛 404", async () => {
    mockConn.execute.mockResolvedValue([[]]);
    await expect(startBargain(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "砍价活动不存在或已结束" });
  });

  it("库存不足抛错", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, total_stock: 10, sold_count: 10,
    }]]);
    await expect(startBargain(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 400, message: "砍价活动库存不足" });
  });

  it("库存仅剩1件 - 应成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_name: "砍价A", original_price: 100, min_price: 50,
        total_stock: 10, sold_count: 9, bargain_times: 10, time_limit_hours: 24,
        help_min_amount: 1, help_max_amount: 10, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentPrice: 100 }]]);
    const res: any = await startBargain(tenantId, 1, 10);
    expect(res.id).toBe(100);
  });

  it("发起砍价成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_name: "砍价A", original_price: 100, min_price: 50,
        total_stock: 100, sold_count: 10, bargain_times: 10, time_limit_hours: 24,
        help_min_amount: 1, help_max_amount: 10, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentPrice: 100 }]]);
    const res: any = await startBargain(tenantId, 1, 10);
    expect(res.id).toBe(100);
  });

  it("初始价格应为原价", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, activity_name: "砍价A", original_price: 99.99, min_price: 50,
        total_stock: 100, sold_count: 10, bargain_times: 10, time_limit_hours: 24,
        help_min_amount: 1, help_max_amount: 10, status: "ACTIVE",
        start_time: "2026-01-01", end_time: "2026-12-31",
      }]])
      .mockResolvedValueOnce([{ insertId: 100 }])
      .mockResolvedValueOnce([[{ id: 100, activityId: 1, currentPrice: 99.99 }]]);
    const res: any = await startBargain(tenantId, 1, 10);
    expect(res.currentPrice).toBe(99.99);
  });
});

describe("community-marketing.service - 帮砍", () => {
  it("砍价记录不存在抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[]]);
    await expect(helpBargain(tenantId, 99, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "砍价记录不存在或已结束" });
  });

  it("砍价已过期抛 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[]]);
    await expect(helpBargain(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 404, message: "砍价记录不存在或已结束" });
  });

  it("不能给自己砍价", async () => {
    mockConn.execute.mockResolvedValueOnce([[{
      id: 1, initiator_id: 1, current_price: 100, bargain_count: 0, status: "ONGOING",
      min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
    }]]);
    await expect(helpBargain(tenantId, 1, 1))
      .rejects.toMatchObject({ statusCode: 400, message: "不能给自己砍价" });
  });

  it("已帮砍过抛错", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 100, bargain_count: 0, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[{ id: 1 }]]);
    await expect(helpBargain(tenantId, 1, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "您已帮砍过" });
  });

  it("达到最大砍价次数抛错", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 50, bargain_count: 10, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[]]);
    await expect(helpBargain(tenantId, 1, 2))
      .rejects.toMatchObject({ statusCode: 400, message: "已达到最大砍价次数" });
  });

  it("帮砍成功（未到最低价）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 100, bargain_count: 0, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await helpBargain(tenantId, 1, 2, "帮砍人");
    expect(res.isSuccess).toBe(false);
    expect(res.status).toBe("ONGOING");
    expect(res.bargainAmount).toBeGreaterThanOrEqual(1);
    expect(res.bargainAmount).toBeLessThanOrEqual(10);
  });

  it("帮砍成功（达到最大次数 - 成功）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 55, bargain_count: 9, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await helpBargain(tenantId, 1, 2, "帮砍人");
    expect(res.isSuccess).toBe(true);
    expect(res.status).toBe("SUCCESS");
  });

  it("帮砍成功（砍到最低价 - 成功）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 51, bargain_count: 1, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await helpBargain(tenantId, 1, 2, "帮砍人");
    expect(res.isSuccess).toBe(true);
    expect(res.status).toBe("SUCCESS");
    expect(res.currentPrice).toBe(50);
  });

  it("helperName 为空时应使用 null", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 100, bargain_count: 0, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 1, help_max_amount: 10,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await helpBargain(tenantId, 1, 2);
    expect(res.isSuccess).toBe(false);
    // 验证插入的 helper_name 为 null
    const insertHelpCall = mockConn.execute.mock.calls.find(
      (call: any) => call[0].includes("INSERT INTO t_bargain_help")
    );
    expect(insertHelpCall).toBeTruthy();
    expect(insertHelpCall[1][2]).toBeNull();
  });

  it("已到最低价但未到最大次数 - 应成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{
        id: 1, initiator_id: 10, current_price: 52, bargain_count: 3, status: "ONGOING",
        min_price: 50, bargain_times: 10, help_min_amount: 10, help_max_amount: 20,
      }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res: any = await helpBargain(tenantId, 1, 2, "帮砍人");
    expect(res.isSuccess).toBe(true);
    expect(res.status).toBe("SUCCESS");
    expect(res.currentPrice).toBe(50);
  });
});
