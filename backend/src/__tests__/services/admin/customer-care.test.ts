/**
 * 管理端客户关怀 service 单元测试
 * 被测文件：src/services/admin/customer-care.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
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

import {
  listCareRules,
  createCareRule,
  updateCareRule,
  deleteCareRule,
  listCareLogs,
  executeCareRule,
} from "../../../services/admin/customer-care.service";

// mockReset 清除 mockResolvedValueOnce 队列，防止跨测试泄漏（踩坑 #26）
beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
});

// ============ listCareRules ============
describe("admin customer-care.service - listCareRules", () => {
  it("返回关怀规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, ruleName: "生日关怀" }]);
    const res = await listCareRules("t1");
    expect(res).toEqual([{ id: 1, ruleName: "生日关怀" }]);
  });
});

// ============ createCareRule ============
describe("admin customer-care.service - createCareRule", () => {
  it("全字段有值（?? 全左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
    const res = await createCareRule({ ruleName: "生日关怀", triggerType: "BIRTHDAY", templateContent: "祝您生日快乐", rewardPoints: 100, rewardCouponId: 5, tenantId: "t1" });
    expect(res).toEqual({ id: 10, ruleName: "生日关怀", triggerType: "BIRTHDAY" });
  });

  it("可选字段缺省（?? 全右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
    const res = await createCareRule({ ruleName: "沉睡唤醒", triggerType: "INACTIVE", tenantId: "t1" });
    expect(res.id).toBe(11);
  });
});

// ============ updateCareRule ============
describe("admin customer-care.service - updateCareRule", () => {
  it("全字段更新", async () => {
    const res = await updateCareRule(1, { ruleName: "新名", triggerType: "BIRTHDAY", templateContent: "新内容", rewardPoints: 50, rewardCouponId: 3, enabled: 1, tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("无字段更新时抛错", async () => {
    await expect(updateCareRule(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
  });
});

// ============ deleteCareRule ============
describe("admin customer-care.service - deleteCareRule", () => {
  it("删除规则及日志", async () => {
    const res = await deleteCareRule(1, "t1");
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

// ============ listCareLogs ============
describe("admin customer-care.service - listCareLogs", () => {
  it("有 customerId + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listCareLogs({ customerId: 1, page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, customerId: 1, customerName: "张三" }] });
  });

  it("无 customerId + total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCareLogs({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ executeCareRule ============
describe("admin customer-care.service - executeCareRule", () => {
  it("规则不存在或已禁用时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(executeCareRule(99, "t1")).rejects.toThrow("关怀规则不存在或已禁用");
  });

  it("BIRTHDAY + rewardPoints > 0 + cp 存在（全部积分分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, ruleName: "生日关怀", triggerType: "BIRTHDAY", templateContent: "快乐", rewardPoints: 100 })  // rule
      .mockResolvedValueOnce({ id: 1, availablePoints: 50 })  // cp customer 1
      .mockResolvedValueOnce({ id: 2, availablePoints: 60 });  // cp customer 2
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])  // BIRTHDAY 目标客户
      .mockResolvedValueOnce([])  // INSERT log customer 1
      .mockResolvedValueOnce([])  // UPDATE t_points customer 1
      .mockResolvedValueOnce([])  // INSERT log customer 2
      .mockResolvedValueOnce([]); // UPDATE t_points customer 2
    const res = await executeCareRule(1, "t1");
    expect(res.executed).toBe(2);
    expect(res.logs).toHaveLength(2);
  });

  it("INACTIVE + rewardPoints = 0 + templateContent 为 null（覆盖 ?? null 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 2, ruleName: "沉睡唤醒", triggerType: "INACTIVE", templateContent: null, rewardPoints: 0 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 3 }])  // INACTIVE 目标客户
      .mockResolvedValueOnce([]);  // INSERT log
    const res = await executeCareRule(2, "t1");
    expect(res.executed).toBe(1);
    expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(1);  // 只查 rule
  });

  it("LEVEL_UP + rewardPoints > 0 + cp 不存在", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 3, ruleName: "升级奖励", triggerType: "LEVEL_UP", templateContent: "恭喜升级", rewardPoints: 200 })
      .mockResolvedValueOnce(null);  // cp 不存在
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 4 }])  // LEVEL_UP 目标客户
      .mockResolvedValueOnce([]);  // INSERT log
    const res = await executeCareRule(3, "t1");
    expect(res.executed).toBe(1);
    // cp 不存在，不执行 UPDATE t_points
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);  // SELECT + INSERT log
  });

  it("其他 triggerType + 无目标客户（for 不执行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 4, ruleName: "全员通知", triggerType: "MANUAL", templateContent: "通知", rewardPoints: 0 });
    mocks.queryWithTenant.mockResolvedValueOnce([]);  // 全部客户（空）
    const res = await executeCareRule(4, "t1");
    expect(res.executed).toBe(0);
    expect(res.logs).toEqual([]);
  });
});
