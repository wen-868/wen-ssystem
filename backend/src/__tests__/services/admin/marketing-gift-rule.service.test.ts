import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { createGiftRule, listGiftRules, getGiftRuleDetail } from "../../../services/admin/marketing-gift-rule.service";

describe("admin/marketing-gift-rule.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("MZ20260815001");
  });

  it("createGiftRule：创建赠品规则", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ insertId: 5 }]);
    const result = await createGiftRule({
      rule_name: "买酒送酒杯", threshold_type: "AMOUNT", threshold_amount: 500,
      start_time: "2026-08-01 00:00:00", end_time: "2026-08-31 23:59:59",
    } as any, "t1", 1);
    expect(result.id).toBe(5);
    expect(result.rule_code).toBe("MZ20260815001");
  });

  it("listGiftRules：分页赠品规则列表", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ cnt: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, rule_name: "买酒送酒杯" }]);
    const result = await listGiftRules({ tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.list[0].rule_name).toBe("买酒送酒杯");
  });

  it("getGiftRuleDetail：返回规则详情含档位", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, rule_name: "买酒送酒杯" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, level: 1 }]);
    const detail = await getGiftRuleDetail(1, "t1");
    expect(detail?.rule_name).toBe("买酒送酒杯");
    expect(detail?.levels).toHaveLength(1);
  });
});
