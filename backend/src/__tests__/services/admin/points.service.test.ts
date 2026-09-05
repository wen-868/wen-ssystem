/**
 * 积分 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/points.service.ts
 */
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

import {
  listPointsRules,
  createPointsRule,
  updatePointsRule,
  adjustCustomerPoints,
  getCustomerPointsRecords,
  listLevelConfigs,
  createLevelConfig,
  updateLevelConfig,
  updateLevelConfigStatus,
  deleteLevelConfig,
  checkLevelUpgrade,
} from "../../../services/admin/points.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.makeBizNo.mockReturnValue("JF202608060001");
});

describe("points.service - 积分规则", () => {
  it("listPointsRules 返回规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, ruleName: "消费积分" }]);
    const res = await listPointsRules("t1");
    expect(res).toEqual([{ id: 1, ruleName: "消费积分" }]);
  });

  it("createPointsRule 成功，dailyLimit 缺省为 0", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 3 });
    const res = await createPointsRule({ ruleName: "消费积分", earnType: "SALE", earnRate: 1, tenantId: "t1" });
    expect(res).toEqual({ id: 3, ruleName: "消费积分", earnType: "SALE", earnRate: 1 });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toContain(0);
  });

  it("updatePointsRule 无字段时抛错，有字段时拼接 SET", async () => {
    await expect(updatePointsRule(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updatePointsRule(1, { ruleName: "新规则", enabled: 1, tenantId: "t1" });
    expect(res.id).toBe(1);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("rule_name = ?, enabled = ?");
  });
});

describe("points.service - adjustCustomerPoints", () => {
  it("积分账户不存在时自动开户再调整（不再抛错）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await adjustCustomerPoints({ customerId: 1, points: 10, type: "ADJUST", tenantId: "t1" });
    expect(res).toEqual({ recordNo: "JF202608060001", customerId: 1, points: 10, balanceAfter: 10 });
    // 第一次 queryWithTenant 应为自动开户 INSERT
    const insertSql = mocks.queryWithTenant.mock.calls[0][0] as string;
    expect(insertSql).toContain("INSERT INTO t_customer_points");
  });

  it("扣减时余额不为负，total_points 只加正值", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, available_points: 5 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await adjustCustomerPoints({ customerId: 1, points: -20, type: "DEDUCT", remark: "违规扣减", tenantId: "t1" });
    expect(res).toEqual({ recordNo: "JF202608060001", customerId: 1, points: -20, balanceAfter: 0 });
    const updateParams = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(updateParams[0]).toBe(0);
    expect(updateParams[1]).toBe(0);
    expect(mocks.queryWithTenant.mock.calls[1][1]).toContain("违规扣减");
  });

  it("增加积分时 total_points 加原值，remark 缺省为 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, available_points: 5 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await adjustCustomerPoints({ customerId: 1, points: 10, type: "EARN", tenantId: "t1" });
    expect(res.balanceAfter).toBe(15);
    expect(mocks.queryWithTenant.mock.calls[1][1]).toContain(null);
  });
});

describe("points.service - getCustomerPointsRecords", () => {
  it("type 筛选与分页", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ recordNo: "R1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getCustomerPointsRecords({ customerId: 1, type: "EARN", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ recordNo: "R1" }] });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("type = ?");
  });
});

describe("points.service - 等级配置", () => {
  it("listLevelConfigs 返回等级列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ levelName: "VIP1" }]);
    const res = await listLevelConfigs("t1");
    expect(res).toEqual([{ levelName: "VIP1" }]);
  });

  it("createLevelConfig benefits 存在时序列化，缺省为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 4 });
    const res = await createLevelConfig({ levelName: "VIP1", minPoints: 0, maxPoints: 100, discountRate: 1, tenantId: "t1" });
    expect(res).toEqual({ id: 4, levelName: "VIP1" });
    expect(mocks.queryWithTenant.mock.calls[0][1]).toContain(null);
    await createLevelConfig({ levelName: "VIP2", minPoints: 101, maxPoints: 500, discountRate: 0.9, benefits: { gift: "酒具" }, tenantId: "t1" });
    expect(mocks.queryWithTenant.mock.calls[1][1]).toContain('{"gift":"酒具"}');
  });

  it("updateLevelConfig 无字段时抛错，有字段时拼接", async () => {
    await expect(updateLevelConfig(1, { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateLevelConfig(1, { discountRate: 0.8, tenantId: "t1" });
    expect(res.id).toBe(1);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("discount_rate = ?");
  });
});

describe("points.service - checkLevelUpgrade", () => {
  it("无积分账户返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await checkLevelUpgrade(1, "t1");
    expect(res).toBeNull();
  });

  it("无匹配等级配置返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total_points: 10 });
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await checkLevelUpgrade(1, "t1");
    expect(res).toBeNull();
  });

  it("当前等级与目标一致返回 null", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total_points: 200 })
      .mockResolvedValueOnce({ level_name: "VIP2" });
    mocks.queryWithTenant.mockResolvedValueOnce([{ levelName: "VIP2", minPoints: 101, maxPoints: 500 }]);
    const res = await checkLevelUpgrade(1, "t1");
    expect(res).toBeNull();
  });

  it("已有等级记录时走 UPDATE 分支并返回升级结果", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total_points: 200 })
      .mockResolvedValueOnce({ level_name: "VIP1" });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ levelName: "VIP2", minPoints: 101, maxPoints: 500 }])
      .mockResolvedValue([{ affectedRows: 1 }]);
    const res = await checkLevelUpgrade(1, "t1");
    expect(res).toEqual({ customerId: 1, oldLevel: "VIP1", newLevel: "VIP2" });
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("UPDATE t_customer_level");
  });

  it("无等级记录时走 INSERT 分支", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total_points: 200 })
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ levelName: "VIP2", minPoints: 101, maxPoints: 500 }])
      .mockResolvedValue([{ affectedRows: 1 }]);
    const res = await checkLevelUpgrade(1, "t1");
    expect(res).toEqual({ customerId: 1, oldLevel: "NONE", newLevel: "VIP2" });
    expect(String(mocks.queryWithTenant.mock.calls[1][0])).toContain("INSERT INTO t_customer_level");
  });
});

describe("points.service - 会员等级删除/启停（R100-02）", () => {
  it("updateLevelConfigStatus 正常启用", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateLevelConfigStatus(1, "active", "t1");
    expect(res).toEqual({ id: 1, status: "active" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("UPDATE t_level_config SET status = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1]).toEqual(["active", 1, "t1"]);
  });

  it("updateLevelConfigStatus 停用时归一化为 disabled", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateLevelConfigStatus(2, "inactive", "t1");
    expect(res.status).toBe("disabled");
  });

  it("updateLevelConfigStatus 等级不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateLevelConfigStatus(99, "active", "t1")).rejects.toMatchObject({
      message: "会员等级不存在",
      statusCode: 404,
    });
  });

  it("deleteLevelConfig 正常删除并返回结果", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteLevelConfig(1, "t1");
    expect(res).toEqual({ id: 1, deleted: true });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_level_config");
  });

  it("deleteLevelConfig 等级不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteLevelConfig(99, "t1")).rejects.toMatchObject({
      message: "会员等级不存在",
      statusCode: 404,
    });
  });

  it("listLevelConfigs 查询包含 status 字段", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, status: "active" }]);
    await listLevelConfigs("t1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status");
  });

  it("checkLevelUpgrade 只匹配启用状态等级", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total_points: 200 });
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    await checkLevelUpgrade(1, "t1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("status = 'active'");
  });
});
