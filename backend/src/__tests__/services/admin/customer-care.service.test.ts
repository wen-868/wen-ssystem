import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listCareRules, createCareRule, deleteCareRule, listCareLogs, executeCareRule } from "../../../services/admin/customer-care.service";

describe("admin/customer-care.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listCareRules：返回关怀规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, ruleName: "生日关怀" }]);
    const result = await listCareRules("t1");
    expect(result[0].ruleName).toBe("生日关怀");
  });

  it("createCareRule：创建关怀规则", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 4 });
    const result = await createCareRule({ ruleName: "生日关怀", triggerType: "BIRTHDAY", tenantId: "t1" });
    expect(result.id).toBe(4);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_customer_care_rule"),
      expect.arrayContaining(["生日关怀", "BIRTHDAY", "t1"]),
      "t1"
    );
  });

  it("deleteCareRule：删除规则及日志", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteCareRule(5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_customer_care_log"),
      [5, "t1"],
      "t1"
    );
  });

  it("listCareLogs：分页关怀记录（联客户名/规则名）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, customerName: "张三", ruleName: "生日关怀" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listCareLogs({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].customerName).toBe("张三");
  });

  it("executeCareRule：执行启用的关怀规则", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, ruleName: "生日关怀", triggerType: "BIRTHDAY", templateContent: "祝您生日快乐", rewardPoints: 100 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ customer_id: 1, name: "张三", mobile: "13800000000" }]);
    const result = await executeCareRule(1, "t1");
    expect(result).not.toBeNull();
  });
});
