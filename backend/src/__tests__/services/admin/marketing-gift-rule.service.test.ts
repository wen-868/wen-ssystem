import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));
vi.mock("../../../shared/id", () => ({
  makeBizNo: () => "MZ2026081500001",
}));

import {
  createGiftRule,
  listGiftRules,
  getGiftRuleDetail,
  updateGiftRule,
  deleteGiftRule,
  activateGiftRule,
} from "../../../services/admin/marketing-gift-rule.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-gift-rule.service - 赠品规则", () => {
  it("createGiftRule 返回新 id 与编码（数组归一化 insertId）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 8 }]);
    const res = await createGiftRule({
      rule_name: "满200送酒", threshold_type: "AMOUNT", threshold_amount: 200,
      applicable_scope: "ALL", start_time: "2026-01-01", end_time: "2026-12-31",
      gift_stock_limit: 100, is_stock_synced: true,
    }, tenantId, 9);
    expect(res).toEqual({ id: 8, rule_code: "MZ2026081500001" });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_gift_rule");
    expect(params[0]).toBe("MZ2026081500001");
  });

  it("listGiftRules 带状态筛选分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, rule_name: "满200送酒" }]);
    const res = await listGiftRules({ tenantId, status: "ACTIVE", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.list[0].rule_name).toBe("满200送酒");
  });

  it("getGiftRuleDetail 返回规则与档位，不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, rule_name: "规则A" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 10, threshold_amount: 200 }]);
    const detail = await getGiftRuleDetail(1, tenantId);
    expect(detail?.levels).toHaveLength(1);

    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await getGiftRuleDetail(99, tenantId)).toBeNull();
  });

  it("updateGiftRule 部分字段更新", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateGiftRule(1, { rule_name: "新规则", gift_stock_limit: 50 }, tenantId);
    expect(res).toEqual({ id: 1 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("SET rule_name = ?, gift_stock_limit = ?");
    expect(params).toEqual(["新规则", 50, 1, tenantId]);
  });

  it("deleteGiftRule 级联删除档位与规则", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteGiftRule(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_gift_rule_level");
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("DELETE FROM t_gift_rule");
  });

  it("activateGiftRule 更新状态", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await activateGiftRule(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = 'ACTIVE'");
  });
});
