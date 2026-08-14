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

import {
  createStackRule,
  listStackRules,
  updateStackRule,
  deleteStackRule,
} from "../../../services/admin/marketing-stack-rule.service";

const tenantId = "t1";

function mockRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "满减+折扣",
    typeCombination: "[[\"FULL_REDUCTION\",\"DISCOUNT\"]]",
    maxTotalDiscountRate: 0.5,
    priority: 10,
    enabled: 1,
    createdAt: "2026-08-15",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-stack-rule.service - 营销叠加规则", () => {
  it("createStackRule 插入后返回最新规则", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.queryOneWithTenant.mockResolvedValue(mockRule());
    const res = await createStackRule({ name: "满减+折扣", typeCombination: [["FULL_REDUCTION", "DISCOUNT"]], maxTotalDiscountRate: 0.5, priority: 10, enabled: true }, tenantId);
    expect(res.name).toBe("满减+折扣");
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_promo_stack_rule");
    expect(params[1]).toContain("FULL_REDUCTION");
    expect(params[4]).toBe(1);
  });

  it("listStackRules 按优先级返回", async () => {
    mocks.queryWithTenant.mockResolvedValue([mockRule(), mockRule({ id: 2, priority: 5 })]);
    const res = await listStackRules(tenantId);
    expect(res.total).toBe(2);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("ORDER BY priority DESC");
  });

  it("updateStackRule 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateStackRule(99, { name: "X" }, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "叠加规则不存在" });
  });

  it("updateStackRule 仅更新传入字段", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(mockRule({ name: "新规则" }));
    await updateStackRule(1, { name: "新规则", enabled: false }, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("SET name = ?, enabled = ?");
    expect(params).toEqual(["新规则", 0, 1]);
  });

  it("deleteStackRule 不存在抛 404，存在则删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(deleteStackRule(99, tenantId)).rejects.toMatchObject({ statusCode: 404 });

    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteStackRule(1, tenantId);
    expect(res).toEqual({ id: 1, deleted: true });
  });
});
