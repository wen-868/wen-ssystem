/**
 * 管理端提成 service 单元测试
 * 被测文件：src/services/admin/commission.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  calculateCommissions,
  settleCommissions,
  listCommissionRecords,
} from "../../../services/admin/commission.service";

describe("commission.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listCommissionRules", () => {
    it("返回规则列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, ruleName: "规则1" }]);
      const res = await listCommissionRules("t1");
      expect(res.length).toBe(1);
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("FROM sales_commission_rule");
      expect(params).toEqual(["t1"]);
    });
  });

  describe("createCommissionRule", () => {
    it("创建规则并返回 id（config 序列化）", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 5 });
      const res = await createCommissionRule({
        ruleName: "R", ruleType: "FIXED_RATE", config: { rate: 0.1 }, tenantId: "t1",
      });
      expect(res.id).toBe(5);
      expect(res.ruleName).toBe("R");
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("INSERT INTO sales_commission_rule");
      expect(params).toEqual(["R", "FIXED_RATE", JSON.stringify({ rate: 0.1 }), null, null, null, "t1"]);
    });

    it("带生效区间和备注", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 6 });
      await createCommissionRule({
        ruleName: "R", ruleType: "TIERED", config: {},
        effectiveStart: "2026-01-01", effectiveEnd: "2026-12-31", remark: "备注", tenantId: "t1",
      });
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params).toEqual(["R", "TIERED", "{}", "2026-01-01", "2026-12-31", "备注", "t1"]);
    });
  });

  describe("updateCommissionRule", () => {
    it("规则不存在时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(updateCommissionRule(1, { tenantId: "t1" })).rejects.toThrow("规则不存在");
    });

    it("无字段更新时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      await expect(updateCommissionRule(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
    });

    it("更新多个字段并返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateCommissionRule(1, { ruleName: "新名", status: 0, tenantId: "t1" });
      expect(res.id).toBe(1);
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("rule_name = ?");
      expect(sql).toContain("status = ?");
      expect(params).toEqual(["新名", 0, 1, "t1"]);
    });

    it("config 更新时序列化为字符串", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      await updateCommissionRule(1, { config: { a: 1 }, tenantId: "t1" });
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params[0]).toBe(JSON.stringify({ a: 1 }));
    });
  });

  describe("deleteCommissionRule", () => {
    it("规则不存在时抛错", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(deleteCommissionRule(1, "t1")).rejects.toThrow("规则不存在");
    });

    it("存在时执行删除并返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await deleteCommissionRule(1, "t1");
      expect(res).toEqual({ id: 1 });
    });
  });

  describe("calculateCommissions", () => {
    it("无生效规则时返回 0", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]); // bills
      mocks.queryWithTenant.mockResolvedValueOnce([]); // rules
      const res = await calculateCommissions({ startDate: "2026-01-01", endDate: "2026-01-31", tenantId: "t1" });
      expect(res.calculated).toBe(0);
      expect(res.records).toEqual([]);
    });

    it("FIXED_RATE 规则计算并写入记录", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { billNo: "B1", staffId: 1, receivableAmount: 1000, receivedAmount: 1000 },
      ]); // bills
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 1, ruleName: "R", ruleType: "FIXED_RATE", config: JSON.stringify({ rate: 0.1 }) },
      ]); // rules
      mocks.queryOneWithTenant.mockResolvedValueOnce(null); // existing (无)
      mocks.makeBizNo.mockReturnValue("TC001");
      mocks.queryWithTenant.mockResolvedValueOnce(undefined); // insert

      const res = await calculateCommissions({ startDate: "2026-01-01", endDate: "2026-01-31", tenantId: "t1" });
      expect(res.calculated).toBe(1);
      expect(res.records[0].commissionAmount).toBe(100);
      expect(res.records[0].recordNo).toBe("TC001");
    });

    it("已存在记录时跳过", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { billNo: "B1", staffId: 1, receivableAmount: 1000, receivedAmount: 1000 },
      ]);
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 1, ruleName: "R", ruleType: "FIXED_AMOUNT", config: { fixedAmount: 50 } },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 99 }); // existing
      const res = await calculateCommissions({ startDate: "s", endDate: "e", tenantId: "t1" });
      expect(res.calculated).toBe(0);
    });

    it("FIXED_AMOUNT 规则使用固定金额", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { billNo: "B2", staffId: 2, receivableAmount: 500, receivedAmount: 500 },
      ]);
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 2, ruleName: "F", ruleType: "FIXED_AMOUNT", config: { fixedAmount: 30 } },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      mocks.makeBizNo.mockReturnValue("TC002");
      mocks.queryWithTenant.mockResolvedValueOnce(undefined);
      const res = await calculateCommissions({ startDate: "s", endDate: "e", tenantId: "t1" });
      expect(res.records[0].commissionAmount).toBe(30);
    });

    it("TIERED 规则按阶梯计算", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { billNo: "B3", staffId: 3, receivableAmount: 1500, receivedAmount: 1500 },
      ]);
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 3, ruleName: "T", ruleType: "TIERED", config: { tiers: [{ min: 2000, rate: 0.2 }, { min: 1000, rate: 0.1 }] } },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      mocks.makeBizNo.mockReturnValue("TC003");
      mocks.queryWithTenant.mockResolvedValueOnce(undefined);
      const res = await calculateCommissions({ startDate: "s", endDate: "e", tenantId: "t1" });
      // 1500 命中 min=1000 阶梯，1500*0.1=150
      expect(res.records[0].commissionAmount).toBe(150);
    });
  });

  describe("settleCommissions", () => {
    it("批量结算并返回数量", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await settleCommissions({ recordNos: ["TC1", "TC2"], tenantId: "t1" });
      expect(res.settled).toBe(2);
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("status = 'SETTLED'");
      expect(params).toEqual(["TC1", "TC2", "t1"]);
    });
  });

  describe("listCommissionRecords", () => {
    it("无 staffId/status 时返回全部", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ recordNo: "TC1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      const res = await listCommissionRecords({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
    });

    it("带 staffId 和 status 筛选", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listCommissionRecords({ page: 1, pageSize: 10, staffId: 5, status: "PENDING", tenantId: "t1" });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("cr.staff_id = ?");
      expect(sql).toContain("cr.status = ?");
      expect(params).toEqual(["t1", 5, "PENDING", 10, 0]);
    });

    it("total 为 null 时归零", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listCommissionRecords({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(0);
    });
  });
});
