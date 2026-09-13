/**
 * 平台看板总览 service 单元测试（R101-S2-01 批 3 新增字段）
 * 被测文件：src/services/platform/platform-overview.service.ts
 *
 * 批 3 交付：tenantTrend / incomeComposition / monthlyRevenueWan / totalRevenueWan。
 * 重点断言：
 *  - 元↔万元换算发生在**后端**（裁定③：前端零换算），且四舍五入 2 位；
 *  - tenantTrend 的 date 透传为字符串（用 DATE_FORMAT 保证，避免 Date 对象喂给图表）；
 *  - planDistribution 字段名是 planName（前端据此适配）；
 *  - 无数据时一律返回**空数组**，不编造任何条目。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import { getPlatformDashboardOverview } from "../../../services/platform/platform-overview.service";

/** 按 Promise.all 内的字面量顺序注入 6 组查询结果 */
function stubQueries({
  incomeTrend = [],
  tenantTrend = [],
  incomeComposition = [],
  planDistribution = [],
  tenantStatus = [],
  recentTenants = [],
}: Record<string, unknown[]> = {}) {
  mocks.query
    .mockResolvedValueOnce(incomeTrend)
    .mockResolvedValueOnce(tenantTrend)
    .mockResolvedValueOnce(incomeComposition)
    .mockResolvedValueOnce(planDistribution)
    .mockResolvedValueOnce(tenantStatus)
    .mockResolvedValueOnce(recentTenants);
}

describe("platform-overview.service · getPlatformDashboardOverview（批 3）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryOne.mockResolvedValue({
      totalTenants: 12,
      activeTenants: 9,
      pendingTenants: 2,
      monthlyRevenue: 2184600, // 218.46 万
      totalRevenue: 51234567, // 5123.4567 万 → 5123.46
      newTenantsWeek: 3,
      activeSubscriptions: 9,
      totalAdmins: 4,
    });
  });

  it("金额同时给「元」与「万元」，换算在后端完成且四舍五入 2 位", async () => {
    stubQueries();
    const r = await getPlatformDashboardOverview();

    // 元：精度不丢
    expect(r.monthlyRevenue).toBe(2184600);
    expect(r.totalRevenue).toBe(51234567);
    // 万元：后端一次换算，2 位
    expect(r.monthlyRevenueWan).toBe(218.46);
    expect(r.totalRevenueWan).toBe(5123.46);
  });

  it("tenantTrend 透传 [{date,newCount}]，date 为字符串、newCount 为数字", async () => {
    stubQueries({
      tenantTrend: [
        { date: "2026-08-15", newCount: "3" }, // DB 可能给字符串数字
        { date: "2026-08-16", newCount: 5 },
      ],
    });
    const r = await getPlatformDashboardOverview();

    expect(r.tenantTrend).toEqual([
      { date: "2026-08-15", newCount: 3 },
      { date: "2026-08-16", newCount: 5 },
    ]);
    expect(typeof r.tenantTrend[0].date).toBe("string");
    expect(typeof r.tenantTrend[0].newCount).toBe("number");
  });

  it("incomeComposition 同时给 amount 与 amountWan", async () => {
    stubQueries({
      incomeComposition: [
        { name: "旗舰版", amount: 1234567 }, // 123.4567 万 → 123.46
        { name: "基础版", amount: 9999 }, // 0.9999 万 → 1
      ],
    });
    const r = await getPlatformDashboardOverview();

    expect(r.incomeComposition).toEqual([
      { name: "旗舰版", amount: 1234567, amountWan: 123.46 },
      { name: "基础版", amount: 9999, amountWan: 1 },
    ]);
  });

  it("planDistribution 字段名保持 planName（前端按此适配）", async () => {
    stubQueries({ planDistribution: [{ planName: "旗舰版", count: 5 }] });
    const r = await getPlatformDashboardOverview();

    expect(r.planDistribution).toEqual([{ planName: "旗舰版", count: 5 }]);
    // 不得出现前端旧写法残留的 name 字段
    expect(r.planDistribution[0]).not.toHaveProperty("name");
  });

  it("无数据时全部返回空数组，不编造任何条目（禁模拟数据）", async () => {
    stubQueries();
    const r = await getPlatformDashboardOverview();

    expect(r.tenantTrend).toEqual([]);
    expect(r.incomeComposition).toEqual([]);
    expect(r.planDistribution).toEqual([]);
    expect(r.tenantStatus).toEqual([]);
    expect(r.recentTenants).toEqual([]);
    expect(r.incomeTrend).toEqual([]);
    // 计数字段缺失时回落 0，而不是 undefined
    expect(r.totalTenants).toBe(12);
  });

  it("stats 查询返回 null 时，所有数值回落 0 且万元字段为 0", async () => {
    mocks.queryOne.mockResolvedValue(null);
    stubQueries();
    const r = await getPlatformDashboardOverview();

    expect(r.monthlyRevenue).toBe(0);
    expect(r.monthlyRevenueWan).toBe(0);
    expect(r.totalRevenueWan).toBe(0);
    expect(r.activeTenants).toBe(0);
  });
});
