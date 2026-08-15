import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listRules, createRule, deleteRule } from "../../../services/admin/approval-flow.service";

describe("admin/approval-flow.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listRules：分页审批规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, rule_name: "采购审批" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listRules({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].rule_name).toBe("采购审批");
  });

  it("createRule：创建审批规则", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await createRule({
      ruleName: "采购审批", businessType: "PURCHASE_ORDER", triggerCondition: {}, approvalChain: [{ level: 1, approverType: "ROLE", approverValue: "BOSS" }], slaHours: 24, escalationLevel: 1,
    }, 1, "管理员", "t1");
    expect(result.ruleName).toBe("采购审批");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_approval_rule"),
      expect.arrayContaining(["采购审批", "t1"]),
      "t1"
    );
  });

  it("deleteRule：删除审批规则", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 5 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 }); // 引用检查
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteRule(5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_approval_rule"),
      [5],
      "t1"
    );
  });
});
