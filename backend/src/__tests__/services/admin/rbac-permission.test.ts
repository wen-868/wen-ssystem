/**
 * RBAC 权限匹配单元测试（S3-122-F1 权限 matcher 支持通配符）
 * 被测文件：src/services/admin/rbac.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: mocks.loggerWarn },
}));

import { matchPermission, checkUserPermission } from "../../../services/admin/rbac.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("matchPermission - a) 全通配 *", () => {
  it('["*"] 对任意权限码通过', () => {
    expect(matchPermission(["*"], "product:view")).toBe(true);
    expect(matchPermission(["*"], "sale:create")).toBe(true);
    expect(matchPermission(["*"], "dashboard")).toBe(true);
  });
});

describe("matchPermission - b) 动作通配 *:<action>", () => {
  it('["*:view"] 对 product:view / sale:view 通过，对 sale:create 不通过', () => {
    expect(matchPermission(["*:view"], "product:view")).toBe(true);
    expect(matchPermission(["*:view"], "sale:view")).toBe(true);
    expect(matchPermission(["*:view"], "sale:create")).toBe(false);
  });

  it('["*:view"] 不误命中非 "…:view" 结尾的码', () => {
    expect(matchPermission(["*:view"], "product:preview")).toBe(false);
    expect(matchPermission(["*:view"], "product:viewSelf")).toBe(false);
  });
});

describe("matchPermission - c) 模块通配 <dom>:*", () => {
  it('["sale:*"] 对 sale:create 通过，对 product:view 不通过', () => {
    expect(matchPermission(["sale:*"], "sale:create")).toBe(true);
    expect(matchPermission(["sale:*"], "sale:view")).toBe(true);
    expect(matchPermission(["sale:*"], "product:view")).toBe(false);
  });
});

describe("matchPermission - d) 精确码", () => {
  it("精确码命中即通过，其余不通过", () => {
    expect(matchPermission(["product:view", "sale:create"], "sale:create")).toBe(true);
    expect(matchPermission(["product:view"], "sale:create")).toBe(false);
  });
});

describe("matchPermission - e) 空数组", () => {
  it("空数组一律不通过", () => {
    expect(matchPermission([], "product:view")).toBe(false);
    expect(matchPermission([], "")).toBe(false);
  });
});

describe("checkUserPermission - e) 非 JSON 权限字段 fail-safe", () => {
  it("非 JSON 字串 ⇒ 不通过且不抛错，并留 warn 日志", async () => {
    mocks.query.mockResolvedValue([{ permissions: "not-json" }]);

    await expect(checkUserPermission(1, 1, "product:view")).resolves.toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  it("权限字段为 JSON 对象（非数组）⇒ 不通过且不抛错", async () => {
    mocks.query.mockResolvedValue([{ permissions: '{"product:view":true}' }]);

    await expect(checkUserPermission(1, 1, "product:view")).resolves.toBe(false);
  });

  it("权限字段为空/空数组 ⇒ 不通过且不抛错", async () => {
    mocks.query.mockResolvedValue([{ permissions: null }, { permissions: "[]" }]);

    await expect(checkUserPermission(1, 1, "product:view")).resolves.toBe(false);
  });
});

describe("checkUserPermission - f) 多角色并集", () => {
  beforeEach(() => {
    mocks.query.mockResolvedValue([{ permissions: '["*:view"]' }, { permissions: '["sale:create"]' }]);
  });

  it("任一角色满足即通过（第二个角色满足）", async () => {
    await expect(checkUserPermission(1, 1, "sale:create")).resolves.toBe(true);
  });

  it("任一角色满足即通过（第一个角色满足）", async () => {
    await expect(checkUserPermission(1, 1, "sale:view")).resolves.toBe(true);
  });

  it("所有角色都不满足 ⇒ 不通过", async () => {
    await expect(checkUserPermission(1, 1, "product:delete")).resolves.toBe(false);
  });
});
