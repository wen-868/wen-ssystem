/**
 * 管理端审批规则 service 单元测试
 * 被测文件：src/services/admin/approval-flow.service.ts（deleteRule 专项）
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

import { deleteRule } from "../../../services/admin/approval-flow.service";

describe("approval-flow.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("deleteRule", () => {
    it("规则不存在时返回 null，不执行删除", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await deleteRule(999, "t1");
      expect(res).toBeNull();
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("规则已被审批实例引用时抛 400，不执行删除", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 2 });
      await expect(deleteRule(1, "t1")).rejects.toMatchObject({
        message: "该审批规则已被审批实例使用，无法删除",
        statusCode: 400,
      });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("规则存在且未被引用时执行 DELETE 并返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await deleteRule(1, "t1");
      expect(res).toEqual({ id: 1 });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("DELETE FROM t_approval_rule");
      expect(params).toEqual([1]);
    });
  });
});
