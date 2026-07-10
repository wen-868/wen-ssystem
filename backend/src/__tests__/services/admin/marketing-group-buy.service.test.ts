import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  createGroupBuy,
  listGroupBuys,
  getGroupBuy,
  updateGroupBuy,
  deleteGroupBuy,
  activateGroupBuy,
  listGroupBuyTeams,
  listActiveGroupBuys,
  createGroupBuyTeam,
  getGroupBuyTeam,
  joinGroupBuyTeam,
} from "../../../services/admin/marketing-group-buy.service.js";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("admin marketing-group-buy.service - createGroupBuy", () => {
  it("创建拼团活动", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "拼团A" });
    const res: any = await createGroupBuy({
      name: "拼团A", productId: 1, skuId: 10, groupPrice: 88, originalPrice: 188,
      minGroupSize: 2, maxGroupSize: 5, timeLimitHours: 24, totalStock: 100,
      startTime: "2026-01-01", endTime: "2026-12-31",
    }, tenantId);
    expect(res.id).toBe(1);
  });
});

describe("admin marketing-group-buy.service - listGroupBuys", () => {
  it("无筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listGroupBuys(1, 10, tenantId);
    expect(res.total).toBe(1);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listGroupBuys(1, 10, tenantId, "ACTIVE");
    expect(res.total).toBe(1);
  });

  it("total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res: any = await listGroupBuys(1, 10, tenantId);
    expect(res.total).toBe(0);
  });
});

describe("admin marketing-group-buy.service - getGroupBuy", () => {
  it("活动存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "拼团" });
    const res: any = await getGroupBuy(1, tenantId);
    expect(res.id).toBe(1);
  });

  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getGroupBuy(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在" });
  });
});

describe("admin marketing-group-buy.service - updateGroupBuy", () => {
  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateGroupBuy(99, {}, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在" });
  });

  it("全字段更新", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE" })
      .mockResolvedValueOnce({ id: 1, name: "新拼团" });
    const res: any = await updateGroupBuy(1, { name: "新拼团" }, tenantId);
    expect(res.id).toBe(1);
  });

  it("空 body（updates===0 跳过 UPDATE）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "ACTIVE" })
      .mockResolvedValueOnce({ id: 1, name: "拼团" });
    const res: any = await updateGroupBuy(1, {}, tenantId);
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

describe("admin marketing-group-buy.service - deleteGroupBuy", () => {
  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteGroupBuy(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在" });
  });

  it("非草稿状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "ACTIVE" });
    await expect(deleteGroupBuy(1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "仅草稿状态的拼团活动可删除" });
  });

  it("草稿状态删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    const res: any = await deleteGroupBuy(1, tenantId);
    expect(res).toEqual({ id: 1, deleted: true });
  });
});

describe("admin marketing-group-buy.service - activateGroupBuy", () => {
  it("活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(activateGroupBuy(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在" });
  });

  it("非草稿/暂停状态抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "ENDED" });
    await expect(activateGroupBuy(1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "仅草稿或暂停状态的活动可激活" });
  });

  it("草稿状态激活", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    const res: any = await activateGroupBuy(1, tenantId);
    expect(res).toEqual({ id: 1, status: "ACTIVE" });
  });
});

describe("admin marketing-group-buy.service - listGroupBuyTeams", () => {
  it("无筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listGroupBuyTeams(1, 10, tenantId);
    expect(res.total).toBe(1);
  });

  it("有 activityId + status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res: any = await listGroupBuyTeams(1, 10, tenantId, 1, "PENDING");
    expect(res.total).toBe(1);
  });

  it("total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res: any = await listGroupBuyTeams(1, 10, tenantId);
    expect(res.total).toBe(0);
  });
});

describe("admin marketing-group-buy.service - listActiveGroupBuys", () => {
  it("有活跃拼团", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res: any = await listActiveGroupBuys(tenantId);
    expect(res.total).toBe(2);
  });

  it("无活跃拼团", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res: any = await listActiveGroupBuys(tenantId);
    expect(res.total).toBe(0);
  });
});

describe("admin marketing-group-buy.service - createGroupBuyTeam", () => {
  it("拼团活动不存在或已结束 → 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[], []]);
    await expect(createGroupBuyTeam(99, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团活动不存在或已结束" });
  });

  it("拼团库存不足 → 400", async () => {
    mockConn.execute.mockResolvedValueOnce([[{ total_stock: 5, sold_count: 5 }], []]);
    await expect(createGroupBuyTeam(1, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "拼团库存不足" });
  });

  it("创建拼团组成功", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ total_stock: 100, sold_count: 0, min_group_size: 2, time_limit_hours: 24 }], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([[{ id: 1, activityId: 1, leaderId: 1 }], []]);
    const res: any = await createGroupBuyTeam(1, 1, 1, tenantId);
    expect(res.id).toBe(1);
  });
});

describe("admin marketing-group-buy.service - getGroupBuyTeam", () => {
  it("拼团组存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, activityName: "拼团" });
    mocks.queryWithTenant.mockResolvedValue([{ userId: 1 }]);
    const res: any = await getGroupBuyTeam(1, tenantId);
    expect(res.id).toBe(1);
    expect(res.members).toHaveLength(1);
  });

  it("拼团组不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getGroupBuyTeam(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团组不存在" });
  });
});

describe("admin marketing-group-buy.service - joinGroupBuyTeam", () => {
  it("拼团组不存在或已结束 → 404", async () => {
    mockConn.execute.mockResolvedValueOnce([[], []]);
    await expect(joinGroupBuyTeam(99, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "拼团组不存在或已结束" });
  });

  it("已参与该团 → 400", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ current_size: 1, target_size: 2, total_stock: 100, sold_count: 0 }], []])
      .mockResolvedValueOnce([[{ id: 1 }], []]);
    await expect(joinGroupBuyTeam(1, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "您已参与该团" });
  });

  it("该团已满员 → 400", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ current_size: 2, target_size: 2 }], []])
      .mockResolvedValueOnce([[], []]);
    await expect(joinGroupBuyTeam(1, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "该团已满员" });
  });

  it("拼团库存不足 → 400", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ current_size: 1, target_size: 2, total_stock: 1, sold_count: 1 }], []])
      .mockResolvedValueOnce([[], []]);
    await expect(joinGroupBuyTeam(1, 1, 1, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "拼团库存不足" });
  });

  it("参团成功（未满员）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ current_size: 1, target_size: 3, total_stock: 100, sold_count: 0, activity_id: 1 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING", activityName: "拼团" });
    const res: any = await joinGroupBuyTeam(1, 2, 1, tenantId);
    expect(res.message).toBe("参团成功");
  });

  it("拼团成功（满员）", async () => {
    mockConn.execute
      .mockResolvedValueOnce([[{ current_size: 1, target_size: 2, total_stock: 100, sold_count: 0, activity_id: 1 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "COMPLETED", activityName: "拼团" });
    const res: any = await joinGroupBuyTeam(1, 2, 1, tenantId);
    expect(res.message).toBe("拼团成功");
  });
});
