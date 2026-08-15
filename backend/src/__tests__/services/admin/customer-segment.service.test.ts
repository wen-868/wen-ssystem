import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { createSegment, listSegments, updateSegment, deleteSegment, listSegmentMembers } from "../../../services/admin/customer-segment.service";

describe("admin/customer-segment.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("createSegment：创建客户分群", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 2 });
    const result = await createSegment({ segmentName: "高价值客户", conditions: { minAmount: 5000 }, tenantId: "t1" });
    expect(result.id).toBe(2);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_customer_segment"),
      expect.arrayContaining(["高价值客户", "t1"]),
      "t1"
    );
  });

  it("listSegments：返回分群列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, segmentName: "高价值客户" }]);
    const result = await listSegments("t1");
    expect(result[0].segmentName).toBe("高价值客户");
  });

  it("updateSegment：更新分群条件", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await updateSegment(1, { segmentName: "新名称", tenantId: "t1" });
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_customer_segment"),
      expect.arrayContaining(["新名称", 1, "t1"]),
      "t1"
    );
  });

  it("deleteSegment：删除分群及成员", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteSegment(1, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_customer_segment_member"),
      [1, "t1"],
      "t1"
    );
  });

  it("listSegmentMembers：分页分群成员", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ customer_id: 1, name: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listSegmentMembers({ segmentId: 1, page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].name).toBe("张三");
  });
});
