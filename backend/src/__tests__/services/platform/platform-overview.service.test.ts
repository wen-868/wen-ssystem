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

  it("tenantTrend 透传 [{date,newCount,cumCount}]，date 为字符串、计数为数字（S3-20 累计）", async () => {
    stubQueries({
      tenantTrend: [
        { date: "2026-08-15", newCount: "3" }, // DB 可能给字符串数字
        { date: "2026-08-16", newCount: 5 },
      ],
    });
    const r = await getPlatformDashboardOverview();

    // 窗口前基数 = totalTenants(12) − 窗口内新增合计(3+5) = 4
    expect(r.tenantTrend).toEqual([
      { date: "2026-08-15", newCount: 3, cumCount: 7 },
      { date: "2026-08-16", newCount: 5, cumCount: 12 },
    ]);
    expect(typeof r.tenantTrend[0].date).toBe("string");
    expect(typeof r.tenantTrend[0].newCount).toBe("number");
    expect(typeof r.tenantTrend[0].cumCount).toBe("number");
  });

  it("S3-20：窗口前基数算成负数时按 0 兜底（不编造累计值），且不补零行", async () => {
    stubQueries({ tenantTrend: [{ date: "2026-08-15", newCount: 20 }] });
    const r = await getPlatformDashboardOverview();
    expect(r.tenantTrend).toEqual([{ date: "2026-08-15", newCount: 20, cumCount: 20 }]);
  });

  it("S3-10：9 项经营指标取自聚合；上月收入为 0 时收入环比返回 null（不填 0 冒充）", async () => {
    mocks.queryOne.mockResolvedValue({
      totalTenants: 100,
      activeTenants: 63,
      pendingTenants: 0,
      monthlyRevenue: 2184600,
      totalRevenue: 51234567,
      newTenantsWeek: 3,
      activeSubscriptions: 9,
      totalAdmins: 4,
      todayNewTenants: 12,
      todayNewPaid: 4,
      newTenantsMonth: 86,
      newTenantsLastMonth: 70,
      monthRevenue: 2184600,
      lastMonthRevenue: 0,
      totalOrders: 3842105,
      todayOrders: 26431,
      aiCostMonth: "86420.5",
      aiTokensMonth: "420000000",
    });
    stubQueries();
    const r = await getPlatformDashboardOverview();

    expect(r.todayNewTenants).toBe(12);
    expect(r.todayNewPaid).toBe(4);
    expect(r.tenantDelta).toBe(16); // 86 − 70
    expect(r.incomeDelta).toBeNull(); // 上月为 0 ⇒ 不计算
    expect(r.totalOrders).toBe(3842105);
    expect(r.todayOrders).toBe(26431);
    expect(r.aiCost).toBe(86420.5);
    expect(r.aiTokens).toBe(420000000);
    expect(r.activeRate).toBeNull(); // 近 7 日活跃率无载体
  });

  it("S3-10：上月收入非 0 时收入环比按 (本月−上月)/上月 ×100 计算（1 位小数）", async () => {
    mocks.queryOne.mockResolvedValue({
      totalTenants: 1,
      activeTenants: 1,
      pendingTenants: 0,
      monthlyRevenue: 100,
      totalRevenue: 100,
      newTenantsWeek: 0,
      activeSubscriptions: 0,
      totalAdmins: 0,
      newTenantsMonth: 0,
      newTenantsLastMonth: 0,
      monthRevenue: 1124,
      lastMonthRevenue: 1000,
    });
    stubQueries();
    const r = await getPlatformDashboardOverview();
    expect(r.incomeDelta).toBe(12.4);
    expect(r.tenantDelta).toBe(0);
  });

  it("S3-11：有载体的待办/健康维度给真实值，无载体维度返回 null 并逐条列入 unavailable", async () => {
    mocks.queryOne.mockResolvedValue({
      totalTenants: 1,
      activeTenants: 1,
      pendingTenants: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
      newTenantsWeek: 0,
      activeSubscriptions: 0,
      totalAdmins: 0,
      arrearsTenants: 18,
      openTickets: 7,
      storageUsedBytes: 19971597926, // ≈ 18.6 GB
      aiCalls24h: 100,
      aiCallsOk24h: 99,
      alarmAt: "2026-09-06 22:14:00",
      alarmMessage: "存储水位 ≥60%",
    });
    stubQueries();
    const r = await getPlatformDashboardOverview();

    expect(r.todos).toEqual({ audit: null, arrears: 18, ticket: 7, approval: null });
    expect(r.health.storageUsedGb).toBeCloseTo(18.6, 1);
    expect(r.health.storagePercent).toBeNull();
    expect(r.health.aiGatewaySuccessRate).toBe(99);
    expect(r.health.messageQueue).toBeNull();
    expect(r.lastAlarm).toBe("09-06 22:14 存储水位 ≥60%");
    // 无载体字段必须显式列出（禁止静默当成 0）
    const keys = r.unavailable.map((item) => item.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "activeRate",
        "todos.audit",
        "todos.approval",
        "health.storagePercent",
        "health.messageQueue",
      ])
    );
  });

  it("S3-11：无告警记录时 lastAlarm 为 null；无 AI 调用时网关成功率不造值", async () => {
    mocks.queryOne.mockResolvedValue({ totalTenants: 0, aiCalls24h: 0, aiCallsOk24h: 0 });
    stubQueries();
    const r = await getPlatformDashboardOverview();
    expect(r.lastAlarm).toBeNull();
    expect(r.health.aiGatewaySuccessRate).toBeNull();
    expect(r.health.apiSuccessRate).toBeNull(); // 进程内滑窗无请求
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
