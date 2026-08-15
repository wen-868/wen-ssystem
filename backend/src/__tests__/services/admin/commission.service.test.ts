import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listCommissionRules, createCommissionRule, updateCommissionRule, deleteCommissionRule } from "../../../services/admin/commission.service";

describe("admin/commission.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listCommissionRules：返回提成规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, ruleName: "销售提成" }]);
    const result = await listCommissionRules("t1");
    expect(result[0].ruleName).toBe("销售提成");
  });

  it("createCommissionRule：创建提成规则", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 2 });
    const result = await createCommissionRule({ ruleName: "销售提成", ruleType: "PERCENT", config: { percent: 2 }, tenantId: "t1" });
    expect(result.id).toBe(2);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_sales_commission_rule"),
      expect.arrayContaining(["销售提成", "PERCENT", "t1"]),
      "t1"
    );
  });

  it("updateCommissionRule：更新提成规则", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 2 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await updateCommissionRule(2, { ruleName: "新提成", tenantId: "t1" });
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_sales_commission_rule"),
      expect.arrayContaining(["新提成", 2, "t1"]),
      "t1"
    );
  });

  it("deleteCommissionRule：删除提成规则", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 2 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteCommissionRule(2, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_sales_commission_rule"),
      [2, "t1"],
      "t1"
    );
  });
});
