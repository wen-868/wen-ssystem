/**
 * R101-C6-4-1：平台侧「商品库调取统计」service 单元测试
 *
 * 被测：src/services/platform/library-call-log.service.ts（P1~P4）
 * 契约：docs/tasks/cards/R101-C6-4-0-阿坚-立项草案.md §4.3
 * 硬口径（派单卡三②）：平台侧"调取次数"一律取 t_library_call_log；不得用 t_library_spu.hit_count（扫码命中）；
 *   不得把 /api/open/library/* 或扫码查询写进本表；平台侧不得暴露任何租户私有档案字段（价格/库存）。
 * Q9：类目分布无载体 ⇒ 不注册端点，由 stats.unavailable[] 显式说明。
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
  connQuery: vi.fn(),
  connQueryOne: vi.fn(),
  connExecute: vi.fn(),
}));

import { listCallLogs, getTenantRank, getCallTrend, getCallStats } from "../../../services/platform/library-call-log.service";

let monthCount = 0;
let logRows: any[] = [];
let rankRows: any[] = [];
let trendRows: any[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  monthCount = 0;
  logRows = [];
  rankRows = [];
  trendRows = [];

  mocks.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("COUNT(*) AS total FROM t_library_call_log")) return { total: monthCount };
    throw new Error(`未打桩的 queryOne SQL：${sql}`);
  });

  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("GROUP BY l.tenant_id")) return rankRows;
    if (sql.includes("GROUP BY DATE(created_at)")) return trendRows;
    if (sql.includes("FROM t_library_call_log l")) return logRows;
    throw new Error(`未打桩的 query SQL：${sql}`);
  });
});

/** 所有被调用过的 SQL（口径断言用） */
function allSql(): string[] {
  return [...mocks.query.mock.calls, ...mocks.queryOne.mock.calls].map((c) => String(c[0]));
}

describe("library-call-log.service · P1 调取流水明细", () => {
  it("归一化字段 + total，且 tenantDisplayName 缺省回落空串（不做假数据）", async () => {
    logRows = [
      {
        id: 9,
        tenantId: "t-001",
        tenantDisplayName: null,
        librarySpuId: 123,
        librarySpuCode: "SPU20260101001",
        librarySpuName: "茅台 飞天 53度",
        spuId: 9001,
        skuCount: "2",
        callType: "COPY",
        operatorName: null,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    ];
    mocks.queryOne.mockResolvedValue({ total: 1 });

    const result = await listCallLogs({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.records[0]).toMatchObject({
      tenantId: "t-001",
      tenantDisplayName: "",
      librarySpuId: 123,
      skuCount: 2,
      callType: "COPY",
      operatorName: null,
    });
  });

  it("筛选项按 SQL 文本顺序绑定参数（tenantId/librarySpuId/dateFrom/dateTo + pageSize/offset）", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listCallLogs({
      page: 2,
      pageSize: 20,
      tenantId: "t-001",
      librarySpuId: 123,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });

    const listCall = mocks.query.mock.calls.find((c) => String(c[0]).includes("FROM t_library_call_log l"))!;
    expect(listCall[1]).toEqual(["t-001", 123, "2026-09-01", "2026-09-30", 20, 20]);
    expect(String(listCall[0])).toContain("l.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    expect(String(listCall[0])).toContain("LEFT JOIN t_tenant t ON t.id = l.tenant_id");
  });
});

describe("library-call-log.service · P3/P4 排行与趋势", () => {
  it("P3 排行：本月 + Top N + 租户名左连", async () => {
    rankRows = [
      { tenantId: "t-001", tenantDisplayName: "甲商户", callCount: "5" },
      { tenantId: "t-002", tenantDisplayName: null, callCount: 2 },
    ];

    const result = await getTenantRank(10);

    expect(result.items).toEqual([
      { tenantId: "t-001", tenantDisplayName: "甲商户", callCount: 5 },
      { tenantId: "t-002", tenantDisplayName: "", callCount: 2 },
    ]);
    const rankSql = String(mocks.query.mock.calls[0][0]);
    expect(rankSql).toContain("created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
    expect(rankSql).toContain("LIMIT ?");
    expect(mocks.query.mock.calls[0][1]).toEqual([10]);
  });

  it("P4 趋势：无数据 ⇒ items: []（不补 0 造假），天数越界收敛到 [1, 90]", async () => {
    expect((await getCallTrend(0)).items).toEqual([]);
    expect((await getCallTrend(0)).days).toBe(30);
    expect((await getCallTrend(200)).days).toBe(90);
    expect((await getCallTrend(-5)).days).toBe(1);

    trendRows = [{ date: "2026-10-01", count: "3" }];
    const result = await getCallTrend(30);
    expect(result.items).toEqual([{ date: "2026-10-01", count: 3 }]);
    const trendCall = mocks.query.mock.calls.at(-1)!;
    expect(trendCall[1]).toEqual([30]);
    expect(String(trendCall[0])).toContain("GROUP BY DATE(created_at)");
  });
});

describe("library-call-log.service · P2 汇总与口径铁律", () => {
  it("P2 汇总：本月调取次数 + 排行 + unavailable（含 categoryDist 且说明）", async () => {
    monthCount = 12;
    rankRows = [{ tenantId: "t-001", tenantDisplayName: "甲商户", callCount: 12 }];

    const result = await getCallStats();

    expect(result.monthCallCount).toBe(12);
    expect(result.tenantRank).toEqual([{ tenantId: "t-001", tenantDisplayName: "甲商户", callCount: 12 }]);
    expect(result.unavailable.map((u) => u.key)).toContain("categoryDist");
    expect(result.unavailable[0].reason).toContain("类目");
    // 无数据时不得返回 NaN / 假 0 结构
    expect(Number.isFinite(result.monthCallCount)).toBe(true);
  });

  it("口径铁律：全部 SQL 只从 t_library_call_log 取数（禁用 hit_count / 不碰租户私有档案表）", async () => {
    monthCount = 1;
    await getCallStats();
    await listCallLogs({ page: 1, pageSize: 20 });
    await getTenantRank();
    await getCallTrend();

    const sqls = allSql();
    expect(sqls.length).toBeGreaterThan(0);
    for (const sql of sqls) {
      expect(sql).toContain("t_library_call_log");
      expect(sql).not.toContain("hit_count");
      expect(sql).not.toContain("t_library_spu");
      expect(sql).not.toContain("t_product_spu");
      expect(sql).not.toContain("t_product_sku");
      expect(sql).not.toContain("t_product_price");
      expect(sql).not.toContain("cost_price");
      expect(sql).not.toContain("retail_price");
    }
  });
});
