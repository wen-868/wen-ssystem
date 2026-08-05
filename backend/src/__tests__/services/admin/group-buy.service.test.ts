/**
 * 拼团活动 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/group-buy.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getGroupBuyActivities,
  getGroupBuyRecordDetail,
  cancelGroupBuyRecord,
  createGroupBuyActivity,
  updateGroupBuyActivity,
  deleteGroupBuyActivity,
  getGroupBuyRecords,
  getGroupBuyDetail,
  cancelGroupBuy,
} from "../../../services/admin/group-buy.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("group-buy.service - getGroupBuyActivities", () => {
  it("无筛选时默认分页，total 兜底", async () => {
    mocks.query.mockResolvedValue([{ id: 1 }]);
    mocks.queryOne.mockResolvedValue({ cnt: 1 });
    const res = await getGroupBuyActivities("t1");
    expect(res).toEqual({ records: [{ id: 1 }], total: 1, page: 1, pageSize: 20 });
  });

  it("status/page/pageSize 传入时拼接条件与偏移", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await getGroupBuyActivities("t1", { status: "ACTIVE", page: 2, pageSize: 5 });
    expect(res.total).toBe(0);
    expect(String(mocks.query.mock.calls[0][0])).toContain("gba.status = ?");
    expect(String(mocks.query.mock.calls[0][0])).toContain("LIMIT 5, 5");
  });
});

describe("group-buy.service - getGroupBuyRecordDetail / getGroupBuyDetail", () => {
  it("记录不存在时抛错", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getGroupBuyRecordDetail("GB001")).rejects.toThrow("拼团记录不存在");
  });

  it("记录存在时返回记录与成员", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, group_no: "GB001" });
    mocks.query.mockResolvedValue([{ id: 9 }]);
    const res = await getGroupBuyRecordDetail("GB001");
    expect(res).toEqual({ id: 1, group_no: "GB001", members: [{ id: 9 }] });
  });

  it("getGroupBuyDetail 记录不存在时抛错，存在时返回行", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getGroupBuyDetail("GB002")).rejects.toThrow("拼团记录不存在");
    mocks.queryOne.mockResolvedValueOnce({ id: 2, groupNo: "GB002" });
    const res = await getGroupBuyDetail("GB002");
    expect(res).toEqual({ id: 2, groupNo: "GB002" });
  });
});

describe("group-buy.service - cancelGroupBuyRecord / cancelGroupBuy", () => {
  it("取消拼团记录返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await cancelGroupBuyRecord("GB001");
    expect(res).toEqual({ success: true });
    expect(String(mocks.query.mock.calls[0][0])).toContain("status IN ('PENDING', 'IN_PROGRESS')");
  });

  it("取消拼团返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await cancelGroupBuy("GB001");
    expect(res).toEqual({ success: true });
    expect(String(mocks.query.mock.calls[0][0])).toContain("cancelled_at=NOW()");
  });
});

describe("group-buy.service - createGroupBuyActivity", () => {
  it("maxGroupSize/status 缺省时用 10/PENDING", async () => {
    mocks.query.mockResolvedValue({ insertId: 7 });
    const res = await createGroupBuyActivity({
      productId: 1,
      groupPrice: 50,
      minGroupSize: 2,
      startTime: "2026-01-01",
      endTime: "2026-12-31",
    });
    expect(res).toEqual({ id: 7 });
    const params = mocks.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
    expect(params).toContain("PENDING");
  });
});

describe("group-buy.service - updateGroupBuyActivity / deleteGroupBuyActivity", () => {
  it("更新活动返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateGroupBuyActivity(1, {
      productId: 1,
      groupPrice: 40,
      minGroupSize: 3,
      maxGroupSize: 8,
      startTime: "2026-01-01",
      endTime: "2026-12-31",
      status: "ACTIVE",
    });
    expect(res).toEqual({ success: true });
  });

  it("删除活动返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteGroupBuyActivity(1);
    expect(res).toEqual({ success: true });
  });
});

describe("group-buy.service - getGroupBuyRecords", () => {
  it("activityId/status 筛选与分页", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ cnt: 3 });
    const res = await getGroupBuyRecords("t1", { activityId: 2, status: "ACTIVE", page: 2, pageSize: 10 });
    expect(res.total).toBe(3);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("gbr.activity_id = ?");
    expect(sql).toContain("gbr.status = ?");
  });
});
