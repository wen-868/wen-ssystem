/**
 * 管理端客户分群 service 单元测试
 * 被测文件：src/services/admin/customer-segment.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import {
  createSegment,
  listSegments,
  updateSegment,
  deleteSegment,
  refreshSegmentMembers,
  listSegmentMembers,
} from "../../../services/admin/customer-segment.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ createSegment ============
describe("admin customer-segment.service - createSegment", () => {
  it("autoRefresh 为 true 时存储 1", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
    const res = await createSegment({ segmentName: "高价值客户", conditions: { minAmount: 1000 }, autoRefresh: true, tenantId: "t1" });
    expect(res).toEqual({ id: 10, segmentName: "高价值客户" });
  });

  it("autoRefresh 为 false 时存储 0", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
    const res = await createSegment({ segmentName: "普通客户", conditions: {}, autoRefresh: false, tenantId: "t1" });
    expect(res.id).toBe(11);
  });
});

// ============ listSegments ============
describe("admin customer-segment.service - listSegments", () => {
  it("返回分群列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, segmentName: "VIP" }]);
    const res = await listSegments("t1");
    expect(res).toEqual([{ id: 1, segmentName: "VIP" }]);
  });
});

// ============ updateSegment ============
describe("admin customer-segment.service - updateSegment", () => {
  it("全字段更新（autoRefresh 为 true）", async () => {
    const res = await updateSegment(1, { segmentName: "新名", conditions: { minAmount: 500 }, autoRefresh: true, tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("仅更新 autoRefresh 为 false（覆盖三元 false 分支）", async () => {
    const res = await updateSegment(1, { autoRefresh: false, tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("无字段更新时抛错", async () => {
    await expect(updateSegment(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
  });
});

// ============ deleteSegment ============
describe("admin customer-segment.service - deleteSegment", () => {
  it("删除分群及成员", async () => {
    const res = await deleteSegment(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

// ============ refreshSegmentMembers ============
describe("admin customer-segment.service - refreshSegmentMembers", () => {
  it("分群不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(refreshSegmentMembers(99, "t1")).rejects.toThrow("分群不存在");
  });

  it("conditions 为字符串 + 全部条件有值 + 有成员（JSON.parse 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1,
      conditions: JSON.stringify({ minAmount: 1000, maxAmount: 5000, minOrderCount: 5, lifecycleStage: "ACTIVE", memberLevel: "VIP2", minPoints: 100, tagIds: [1, 2] }),
    });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])  // DELETE
      .mockResolvedValueOnce([{ customerId: 1 }, { customerId: 2 }])  // SELECT members
      .mockResolvedValueOnce([])  // INSERT member 1
      .mockResolvedValueOnce([])  // INSERT member 2
      .mockResolvedValueOnce([]); // UPDATE t_member_count
    const res = await refreshSegmentMembers(1, "t1");
    expect(res).toEqual({ segmentId: 1, memberCount: 2 });
  });

  it("conditions 为对象 + 无条件 + 无成员（直接使用分支 + clauses 为空）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, conditions: {} });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])  // DELETE
      .mockResolvedValueOnce([])  // SELECT members (空)
      .mockResolvedValueOnce([]); // UPDATE t_member_count
    const res = await refreshSegmentMembers(1, "t1");
    expect(res).toEqual({ segmentId: 1, memberCount: 0 });
  });

  it("tagIds 为空数组时不生成 IN 子句", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, conditions: { tagIds: [] } });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await refreshSegmentMembers(1, "t1");
    expect(res.memberCount).toBe(0);
  });
});

// ============ listSegmentMembers ============
describe("admin customer-segment.service - listSegmentMembers", () => {
  it("有数据 + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listSegmentMembers({ segmentId: 1, page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ customerId: 1, customerName: "张三" }] });
  });

  it("无数据 + total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listSegmentMembers({ segmentId: 1, page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});
