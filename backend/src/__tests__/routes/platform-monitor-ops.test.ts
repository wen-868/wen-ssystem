/**
 * R101-C4-1b 段二（包C）平台监控运维端点 + A8 根因修复 路由级测试
 *
 * 端点：
 *   GET  /api/platform/monitor/proxy-audit
 *   GET  /api/platform/monitor/proxy-audit/export
 *   GET  /api/platform/monitor/proxy-audit/:id/report
 *   GET  /api/platform/monitor/storage/top5
 *   GET  /api/platform/monitor/storage/orphan-scan
 *   GET  /api/platform/monitor/tenant-api
 *   GET  /api/platform/monitor/tenant-api/export
 *   GET  /api/platform/monitor/thresholds  +  PUT /api/platform/monitor/thresholds
 *
 * 范式：`src/__tests__/routes/platform-billing-arrears.test.ts`（create-test-app 夹具 +
 * vi.mock("../../shared/db") + 真实 requirePlatformAuth 的"无令牌 ⇒ 401"反测）。
 * 本文件**不 mock service**：用例真正穿过 controller + service（含 tenant-quota 复用路径），
 * 因此「零假数据（null 而非 0）」「配额复用同一口径」「A8 只读真实列」都是实现级断言。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  pool: { query: hoisted.poolQuery },
}));

import { platformMonitorOpsRouter, routeConfig } from "../../routes/platform-monitor-ops.routes";
import { platformMonitorRouter } from "../../routes/platform-monitor.routes";
import { requirePlatformAuth } from "../../middleware/auth";
import { listAuditLogs, getAuditLogById } from "../../services/admin/platform-audit-log.service";
import { parseMonthRange } from "../../services/platform/platform-monitor-ops.service";

const PREFIX = "/api/platform/monitor";
const AUDIT_TABLE = "FROM t_platform_audit_log";

const app = createTestApp({ prefix: PREFIX, router: platformMonitorOpsRouter });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于全部端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(PREFIX, requirePlatformAuth, platformMonitorOpsRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

function sqlOf(call: unknown[]): string {
  return String(call?.[0] ?? "");
}

function paramsOf(call: unknown[]): unknown[] {
  return (call?.[1] as unknown[]) ?? [];
}

function resetDbMocks() {
  hoisted.query.mockReset();
  hoisted.queryOne.mockReset();
  hoisted.queryWithTenant.mockReset();
  hoisted.poolQuery.mockReset();
}

/** 代登录审计行（t_platform_audit_log 真实列 + A8 修复后的派生列） */
function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    adminId: 7,
    adminName: "platform_admin",
    type: "PROXY_LOGIN",
    module: "tenant",
    action: "PROXY_LOGIN",
    description: "代登录租户「测试酒水商行」（账号 admin，事由：客户报障排查）",
    targetType: "tenant",
    targetId: "t1",
    ip: "10.0.0.9",
    ipAddress: null,
    detail: {
      type: "PROXY_LOGIN",
      description: "代登录租户「测试酒水商行」（账号 admin，事由：客户报障排查）",
      tenantId: "t1",
      tenantCode: "T20260623001",
      loginUsername: "admin",
      loginUserId: 3,
      reason: "客户报障排查",
      ttlSeconds: 1800,
    },
    createdAt: "2099-01-01 00:00:00",
    ...overrides,
  };
}

/** 审计列表相关的 queryOne：COUNT 与阈值配置 */
function mockAuditCount(total: number) {
  hoisted.queryOne.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (text.includes("COUNT(*) AS total") && text.includes("t_platform_audit_log")) {
      return { total };
    }
    if (text.includes("FROM t_platform_config")) return null;
    return null;
  });
}

/**
 * 存储 TOP5 用到的 mock：① t_upload_file 聚合（query）；② t_tenant 名称（query）；
 * ③ tenant-quota.service.getTenantQuota 内部 queryOne（套餐/存储配置/AI 计费/各 COUNT）。
 */
function mockStorageDb(options: {
  aggregates: Record<string, unknown>[];
  tenants?: Record<string, unknown>[];
  maxStorageMbByTenant?: Record<string, number | null>;
  tenantNames?: Record<string, unknown>[];
}) {
  hoisted.query.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (text.includes("FROM t_upload_file f")) return options.aggregates;
    if (text.includes("FROM t_tenant t")) return options.tenantNames ?? options.tenants ?? [];
    return [];
  });

  hoisted.queryOne.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const text = String(sql);
    if (text.includes("FROM t_subscription s")) {
      const tenantId = String(params[0] ?? "");
      const maxStorageMb = options.maxStorageMbByTenant?.[tenantId] ?? null;
      return { planName: maxStorageMb == null ? null : "标准版", maxUsers: null, maxStores: null, maxProducts: null, maxStorageMb };
    }
    if (text.includes("FROM t_tenant_config")) return null;
    if (text.includes("FROM t_tenant_ai_billing")) return null;
    if (text.includes("COUNT(*) AS total")) return { total: 0 };
    return null;
  });
}

describe("C4-1b 段二 路由注册（routeConfig + 端点完整性/顺序）", () => {
  const paths: string[] = (platformMonitorOpsRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

  it("routeConfig：prefix=/api/platform/monitor、auth=requirePlatformAuth、router 指向同一实例", () => {
    expect(routeConfig.prefix).toBe(PREFIX);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
    expect(routeConfig.router).toBe(platformMonitorOpsRouter);
  });

  it("9 条端点全部注册在本 router；静态路径先于 :param 通配", () => {
    expect(paths).toEqual([
      "get /proxy-audit",
      "get /proxy-audit/export",
      "get /proxy-audit/:id/report",
      "get /storage/top5",
      "get /storage/orphan-scan",
      "get /tenant-api",
      "get /tenant-api/export",
      "get /thresholds",
      "put /thresholds",
    ]);
    expect(paths.indexOf("get /proxy-audit/export")).toBeLessThan(
      paths.indexOf("get /proxy-audit/:id/report")
    );
  });

  it("与既有 platform-monitor.routes.ts 同前缀不同路径段（不覆盖既有端点）", () => {
    const existing: string[] = (platformMonitorRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toLowerCase()} ${layer.route.path}`);

    expect(existing).toEqual([
      "get /",
      "get /db-status",
      "get /api-stats",
      "get /slow-queries",
      "get /expiring-tenants",
      "post /notify-expiring",
    ]);
    expect(paths.some((path) => existing.includes(path))).toBe(false);
  });
});

describe("C4-1b 段二 C-1 GET /proxy-audit（代登录审计列表）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：按 module+action 口径读审计表，行内带操作人/目标租户/事由/时间", async () => {
    mockAuditCount(1);
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes(AUDIT_TABLE)) return [auditRow()];
      if (text.includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T20260623001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/proxy-audit`).query({ month: "2026-08" });
    const data = res.body.data;
    const row = data.records[0];

    expect(res.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.month).toBe("2026-08");
    expect(row).toMatchObject({
      id: 501,
      ticketNo: null,
      operator: "platform_admin",
      operatorId: 7,
      tenantId: "t1",
      tenant: "测试酒水商行",
      tenantCode: "T20260623001",
      reason: "客户报障排查",
      loginUsername: "admin",
      enterAt: "2099-01-01 00:00:00",
      expiresAt: "2099-01-01 00:30:00",
      exitAt: null,
      duration: null,
      actionSummary: null,
      approver: null,
      ip: "10.0.0.9",
    });
    expect(row.ongoing).toBe(true);
    expect(data.criteria).toContain("PROXY_LOGIN");
    expect(data.fieldNotes.map((note: any) => note.field)).toEqual([
      "ticketNo",
      "exitAt",
      "duration",
      "actionSummary",
      "approver",
    ]);

    // 审计读路径（A8 修复后）：module/action 走真实列，type 走 detail JSON 派生
    const auditSql = sqlOf(hoisted.query.mock.calls[0]);
    expect(auditSql).toContain("module = ?");
    expect(auditSql).toContain("action = ?");
    expect(auditSql).toContain("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type')) = ?");
    expect(auditSql).toContain("DATE(created_at) >= ?");
    expect(auditSql).toContain("DATE(created_at) <= ?");
    expect(auditSql).not.toContain("user_agent");
    // 月份区间闭区间展开（8 月 = 01..31）
    expect(paramsOf(hoisted.query.mock.calls[0])).toEqual([
      "PROXY_LOGIN",
      "tenant",
      "PROXY_LOGIN",
      "2026-08-01",
      "2026-08-31",
      20,
      0,
    ]);
  });

  it("200 空态：无代登录记录 ⇒ records: []（不造数），且仍返回口径与字段说明", async () => {
    mockAuditCount(0);
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/proxy-audit`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.fieldNotes.length).toBeGreaterThan(0);
    // 未传 month ⇒ 当前自然月（不回落固定账期）
    expect(res.body.data.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("operator 筛选进入 SQL（admin_name 精确匹配，真实列）", async () => {
    mockAuditCount(0);
    hoisted.query.mockResolvedValue([]);

    const res = await request(app)
      .get(`${PREFIX}/proxy-audit`)
      .query({ operator: "platform_admin", month: "2026-08" });

    expect(res.status).toBe(200);
    const sql = sqlOf(hoisted.query.mock.calls[0]);
    expect(sql).toContain("admin_name = ?");
    expect(paramsOf(hoisted.query.mock.calls[0])[1]).toBe("platform_admin");
  });

  it("反测②：month=2026-13 ⇒ 400（非法账期，不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/proxy-audit`).query({ month: "2026-13" });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("YYYY-MM");
    expect(hoisted.query).not.toHaveBeenCalled();
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });

  it("反测②：page=0 / pageSize=101 ⇒ 400（不查库）", async () => {
    const pageZero = await request(app).get(`${PREFIX}/proxy-audit`).query({ page: 0 });
    expect(pageZero.status).toBe(400);

    const tooLarge = await request(app).get(`${PREFIX}/proxy-audit`).query({ pageSize: 101 });
    expect(tooLarge.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/proxy-audit`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(hoisted.query).not.toHaveBeenCalled();
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-1x GET /proxy-audit/export（CSV 导出）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：BOM + text/csv + 附件名，行数与总数走响应头", async () => {
    mockAuditCount(1);
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes(AUDIT_TABLE)) return [auditRow()];
      if (text.includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T20260623001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/proxy-audit/export`).query({ month: "2026-08" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv; charset=utf-8");
    expect(String(res.headers["content-disposition"])).toContain("proxy-audit-2026-08");
    expect(res.headers["x-export-rows"]).toBe("1");
    expect(res.headers["x-export-total"]).toBe("1");
    expect(res.headers["x-export-truncated"]).toBe("false");
    expect(res.text.startsWith("\uFEFF")).toBe(true);
    expect(res.text).toContain('"记录ID","操作人","目标租户ID","目标租户"');
    expect(res.text).toContain('"platform_admin"');
    expect(res.text).toContain('"客户报障排查"');
  });

  it("200 空态：无记录时只输出表头（不造行）+ X-Export-Rows=0", async () => {
    mockAuditCount(0);
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/proxy-audit/export`);

    expect(res.status).toBe(200);
    expect(res.headers["x-export-rows"]).toBe("0");
    expect(res.text.trim().split("\n")).toHaveLength(1);
  });

  it("反测②：month=2026-8（非法格式）⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/proxy-audit/export`).query({ month: "2026-8" });

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/proxy-audit/export`);

    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-2 GET /proxy-audit/:id/report（审计报告）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：五步审计法逐条给状态；有载体的步骤 DONE、无载体的如实 NO_CARRIER", async () => {
    hoisted.queryOne.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes(AUDIT_TABLE)) return auditRow();
      return null;
    });
    hoisted.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T20260623001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/proxy-audit/501/report`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.id).toBe(501);
    expect(data.operator).toBe("platform_admin");
    expect(data.tenantName).toBe("测试酒水商行");
    expect(data.reason).toBe("客户报障排查");
    expect(data.ttlSeconds).toBe(1800);
    expect(data.expiresAt).toBe("2099-01-01 00:30:00");
    expect(data.sessionStatus).toBe("ONGOING");
    expect(data.steps.map((step: any) => step.step)).toEqual([1, 2, 3, 4, 5]);
    expect(data.steps.map((step: any) => step.status)).toEqual([
      "DONE",
      "NO_CARRIER",
      "DONE",
      "NO_CARRIER",
      "NO_CARRIER",
    ]);
    expect(data.steps[1].basis).toContain("无审批流表");
    expect(data.fieldNotes.map((note: any) => note.field)).toContain("ticketNo");
  });

  it("200：会话已过期（TTL 已过）⇒ sessionStatus=EXPIRED", async () => {
    hoisted.queryOne.mockImplementation(async (sql: string) => {
      if (String(sql).includes(AUDIT_TABLE)) return auditRow({ createdAt: "2020-01-01 00:00:00" });
      return null;
    });
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/proxy-audit/501/report`);

    expect(res.status).toBe(200);
    expect(res.body.data.sessionStatus).toBe("EXPIRED");
    expect(res.body.data.expiresAt).toBe("2020-01-01 00:30:00");
  });

  it("记录不存在 ⇒ 404（不返回空壳报告）", async () => {
    hoisted.queryOne.mockResolvedValue(null);

    const res = await request(app).get(`${PREFIX}/proxy-audit/999999/report`);

    expect(res.status).toBe(404);
    expect(String(res.body.msg)).toContain("不存在");
  });

  it("反测②：id 非法（0 / abc）⇒ 400（不查库）", async () => {
    const zero = await request(app).get(`${PREFIX}/proxy-audit/0/report`);
    expect(zero.status).toBe(400);

    const nan = await request(app).get(`${PREFIX}/proxy-audit/abc/report`);
    expect(nan.status).toBe(400);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/proxy-audit/501/report`);

    expect(res.status).toBe(401);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-3 GET /storage/top5（租户存储 TOP N）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：按 tenant_id 聚合 file_size 排名；配额复用 getTenantQuota 口径", async () => {
    mockStorageDb({
      aggregates: [
        { tenantId: "t1", usedBytes: "10737418240", fileCount: 120 },
        { tenantId: "t2", usedBytes: "1073741824", fileCount: 9 },
      ],
      tenantNames: [
        { id: "t1", tenantName: "测试酒水商行", tenantCode: "T001" },
        { id: "t2", tenantName: "第二商行", tenantCode: "T002" },
      ],
      maxStorageMbByTenant: { t1: 20480, t2: 1024 },
    });

    const res = await request(app).get(`${PREFIX}/storage/top5`);
    const data = res.body.data;
    const [first, second] = data.records;

    expect(res.status).toBe(200);
    expect(data.limit).toBe(5);
    expect(data.unit).toBe("GB");
    expect(data.total).toBe(2);
    expect(first).toMatchObject({
      rank: 1,
      tenantId: "t1",
      tenantName: "测试酒水商行",
      usedGb: 10,
      fileCount: 120,
      quotaLimitGb: 20,
      usagePercent: 50,
      quotaSource: "TENANT_QUOTA",
    });
    expect(second.usagePercent).toBe(100);

    const aggregateSql = sqlOf(hoisted.query.mock.calls[0]);
    expect(aggregateSql).toContain("FROM t_upload_file f");
    expect(aggregateSql).toContain("IFNULL(SUM(f.file_size), 0) AS usedBytes");
    expect(aggregateSql).toContain("GROUP BY f.tenant_id");
    expect(aggregateSql).toContain("f.status = 1");
    expect(paramsOf(hoisted.query.mock.calls[0])).toEqual([5]);
  });

  it("200：无配额载体 ⇒ quotaLimitGb/usagePercent = null（不填 0）且 quotaSource=UNCONFIGURED", async () => {
    mockStorageDb({
      aggregates: [{ tenantId: "t9", usedBytes: "1024", fileCount: 1 }],
      tenantNames: [{ id: "t9", tenantName: "无套餐租户", tenantCode: "T009" }],
      maxStorageMbByTenant: { t9: null },
    });

    const res = await request(app).get(`${PREFIX}/storage/top5`);
    const row = res.body.data.records[0];

    expect(res.status).toBe(200);
    expect(row.quotaLimitGb).toBeNull();
    expect(row.usagePercent).toBeNull();
    expect(row.quotaSource).toBe("UNCONFIGURED");
    expect(row.usedBytes).toBe(1024);
  });

  it("200 空态：无上传文件 ⇒ records: []（不造数）", async () => {
    mockStorageDb({ aggregates: [], tenantNames: [] });

    const res = await request(app).get(`${PREFIX}/storage/top5`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.notes.join(" ")).toContain("不填 0");
  });

  it("反测②：limit=0 / limit=21 / limit=abc ⇒ 400（不查库）", async () => {
    const zero = await request(app).get(`${PREFIX}/storage/top5`).query({ limit: 0 });
    expect(zero.status).toBe(400);

    const tooLarge = await request(app).get(`${PREFIX}/storage/top5`).query({ limit: 21 });
    expect(tooLarge.status).toBe(400);

    const nan = await request(app).get(`${PREFIX}/storage/top5`).query({ limit: "abc" });
    expect(nan.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/storage/top5`);

    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-4 GET /storage/orphan-scan（孤儿文件扫描）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：两口径命中并逐行回传 reasons（只读，不删除）", async () => {
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("FROM t_upload_file f")) {
        return [
          {
            id: 11,
            tenantId: "ghost",
            fileName: "a.png",
            filePath: "/uploads/a.png",
            fileSize: 2048,
            bizType: null,
            bizId: null,
            createdAt: "2026-09-01 10:00:00",
            tenantMissing: 1,
          },
          {
            id: 12,
            tenantId: "t1",
            fileName: "b.png",
            filePath: "/uploads/b.png",
            fileSize: 512,
            bizType: null,
            bizId: null,
            createdAt: "2026-09-02 10:00:00",
            tenantMissing: 0,
          },
        ];
      }
      if (text.includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/storage/orphan-scan`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.scanLimit).toBe(500);
    expect(data.scanLimitReached).toBe(false);
    expect(data.records[0].reasons).toEqual(["TENANT_MISSING", "NO_BIZ_LINK"]);
    expect(data.records[0].tenantName).toBeNull();
    expect(data.records[1].reasons).toEqual(["NO_BIZ_LINK"]);
    expect(data.records[1].tenantName).toBe("测试酒水商行");
    expect(data.criteria.join(" ")).toContain("TENANT_MISSING");
    expect(data.criteria.join(" ")).toContain("NO_BIZ_LINK");
    // 只读：判定口径里显式写明「不删除、不改状态」
    expect(data.criteria.join(" ")).toContain("不删除");
    expect(data.notes.join(" ")).toContain("待人工确认");

    const sql = sqlOf(hoisted.query.mock.calls[0]);
    // R101-C4-1c：JOIN 谓词必须显式钉 collation（t_upload_file.tenant_id=unicode_ci vs t_tenant.id=0900_ai_ci
    // 在生产真库会报 ERROR 1267；mock/SQLite 无 collation 语义，只能锁生成的 SQL 文本）
    expect(sql).toContain(
      "LEFT JOIN t_tenant t ON t.id = f.tenant_id COLLATE utf8mb4_0900_ai_ci"
    );
    // 反测门禁：COLLATE 只允许出现在 JOIN 谓词这一处（加在筛选侧会丢 idx_tenant_status / idx_tenant_biz）
    expect((sql.match(/COLLATE/g) ?? []).length).toBe(1);
    expect(sql).toContain("f.status = 1");
    expect(sql.toUpperCase()).not.toContain("DELETE");
    expect(sql.toUpperCase()).not.toContain("UPDATE");
  });

  it("tenantId 过滤进入 SQL（参数化，不用拼接）", async () => {
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/storage/orphan-scan`).query({ tenantId: "t1" });

    expect(res.status).toBe(200);
    const sql = sqlOf(hoisted.query.mock.calls[0]);
    expect(sql).toContain("f.tenant_id = ?");
    // R101-C4-1c：筛选侧不得加 COLLATE（参数 COERCIBLE，加 COLLATE 会让租户过滤丢索引）
    expect(sql).not.toMatch(/f\.tenant_id\s*=\s*\?\s*COLLATE/i);
    expect(paramsOf(hoisted.query.mock.calls[0])).toEqual(["t1", 501]);
  });

  it("200 空态：无孤儿文件 ⇒ records: []（不造数）", async () => {
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/storage/orphan-scan`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("反测②：tenantId= 空串 ⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/storage/orphan-scan`).query({ tenantId: "" });

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/storage/orphan-scan`);

    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-5 GET /tenant-api（各租户调用量）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：只读聚合 t_open_api_call_daily（按 tenant_id），无配额载体如实 null", async () => {
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("FROM t_open_api_call_daily")) {
        return [{ tenantId: "t1", callCount: "1234", errorCount: "12" }];
      }
      if (text.includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/tenant-api`).query({ period: "2026-09" });
    const data = res.body.data;
    const row = data.records[0];

    expect(res.status).toBe(200);
    expect(data.period).toBe("2026-09");
    expect(row).toMatchObject({
      tenantId: "t1",
      tenantName: "测试酒水商行",
      callCount: 1234,
      errorCount: 12,
      errorRate: 0.0097,
      quota: null,
      usagePercent: null,
      status: null,
    });
    expect(data.unavailable.map((item: any) => item.key)).toEqual(["quota", "writer"]);
    expect(data.unavailable[0].reason).toContain("无 API 调用配额列");
    expect(data.unavailable[1].reason).toContain("无写入方");

    const sql = sqlOf(hoisted.query.mock.calls[0]);
    expect(sql).toContain("FROM t_open_api_call_daily d");
    expect(sql).toContain("GROUP BY d.tenant_id");
    expect(paramsOf(hoisted.query.mock.calls[0])).toEqual(["2026-09-01", "2026-09-30", 201]);
  });

  it("200 空态：无写入方 ⇒ records: [] 且显式声明原因（不造数）", async () => {
    hoisted.query.mockResolvedValue([]);

    const res = await request(app).get(`${PREFIX}/tenant-api`);

    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.unavailable).toHaveLength(2);
  });

  it("反测②：period=2026-1 ⇒ 400（不查库）", async () => {
    const res = await request(app).get(`${PREFIX}/tenant-api`).query({ period: "2026-1" });

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/tenant-api`);

    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-5x GET /tenant-api/export（月报 CSV）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("200 正向：CSV 表头 + 数据行；配额/使用率留空（无载体，不填 0）", async () => {
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("FROM t_open_api_call_daily")) {
        return [{ tenantId: "t1", callCount: 10, errorCount: 1 }];
      }
      if (text.includes("FROM t_tenant t")) {
        return [{ id: "t1", tenantName: "测试酒水商行", tenantCode: "T001" }];
      }
      return [];
    });

    const res = await request(app).get(`${PREFIX}/tenant-api/export`).query({ period: "2026-09" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv; charset=utf-8");
    expect(String(res.headers["content-disposition"])).toContain("tenant-api-2026-09");
    expect(res.headers["x-export-rows"]).toBe("1");
    expect(res.text).toContain('"租户ID","租户名称","租户编码","账期","调用量","错误数","错误率","配额","使用率(%)"');
    expect(res.text).toContain('"测试酒水商行","T001","2026-09","10","1","0.1"');
  });

  it("反测①：无令牌 ⇒ 401 且不触达数据库", async () => {
    const res = await request(guardedApp).get(`${PREFIX}/tenant-api/export`);

    expect(res.status).toBe(401);
    expect(hoisted.query).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 C-6 GET/PUT /thresholds（监控阈值配置）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  const validPayload = {
    warnPercent: 80,
    alertPercent: 95,
    blockPercent: 100,
    notify: {
      warn: { inApp: true, email: true, sms: false },
      alert: { escalateTicket: false, notifyCsm: true },
      block: { hardLimit429: true, tempQuotaPlus20: false },
    },
  };

  it("GET 200 未配置：configured=false、thresholds=null（不回落内置默认值）", async () => {
    hoisted.queryOne.mockResolvedValue(null);

    const res = await request(app).get(`${PREFIX}/thresholds`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.configured).toBe(false);
    expect(data.thresholds).toBeNull();
    expect(data.configKey).toBe("monitor:thresholds");
    expect(data.note).toContain("不内置任何默认阈值");

    const sql = sqlOf(hoisted.queryOne.mock.calls[0]);
    expect(sql).toContain("FROM t_platform_config");
    expect(paramsOf(hoisted.queryOne.mock.calls[0])).toEqual(["monitor:thresholds", "SAAS"]);
  });

  it("GET 200 已配置：返回整包阈值（configured=true、valid=true）", async () => {
    hoisted.queryOne.mockResolvedValue({ config_value: JSON.stringify({ version: 1, ...validPayload }) });

    const res = await request(app).get(`${PREFIX}/thresholds`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.valid).toBe(true);
    expect(data.thresholds.warnPercent).toBe(80);
    expect(data.thresholds.notify.warn.inApp).toBe(true);
    expect(data.note).toBeNull();
  });

  it("GET 200 库内配置脏（缺字段）：valid=false、thresholds=null（不静默补默认值）", async () => {
    hoisted.queryOne.mockResolvedValue({ config_value: JSON.stringify({ warnPercent: 80 }) });

    const res = await request(app).get(`${PREFIX}/thresholds`);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.thresholds).toBeNull();
    expect(data.note).toContain("不符合契约");
  });

  it("PUT 200 正向：整包 upsert 到 t_platform_config + 平台操作日志留痕（无其它写通道）", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 31 });
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("UPDATE t_platform_config")) return [{ affectedRows: 1 }];
      if (text.includes("INSERT INTO t_platform_audit_log")) return { insertId: 77 };
      return [];
    });

    const res = await request(app).put(`${PREFIX}/thresholds`).send(validPayload);
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.updated).toBe(true);
    expect(data.configKey).toBe("monitor:thresholds");
    expect(data.thresholds.warnPercent).toBe(80);
    expect(data.auditLogId).toBe(77);

    expect(hoisted.query.mock.calls).toHaveLength(2);
    const updateSql = sqlOf(hoisted.query.mock.calls[0]);
    expect(updateSql).toContain("UPDATE t_platform_config");
    expect(paramsOf(hoisted.query.mock.calls[0])[1]).toBe("testadmin");
    const auditSql = sqlOf(hoisted.query.mock.calls[1]);
    expect(auditSql).toContain("INSERT INTO t_platform_audit_log");
    // insertPlatformAuditLog 参数序：adminId, adminName, action, targetType, targetId, detail, ip, module
    const auditParams = paramsOf(hoisted.query.mock.calls[1]);
    expect(auditParams[0]).toBe(1);
    expect(auditParams[1]).toBe("testadmin");
    expect(auditParams[2]).toBe("MONITOR_THRESHOLD_UPDATE");
    expect(auditParams[4]).toBe("monitor:thresholds");
    expect(auditParams[7]).toBe("monitor");
  });

  it("PUT 200：未配置时 INSERT（platform=SAAS / tenant_id=platform / category=monitor）", async () => {
    hoisted.queryOne.mockResolvedValue(null);
    hoisted.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("INSERT INTO t_platform_config")) return [{ insertId: 9 }];
      if (text.includes("INSERT INTO t_platform_audit_log")) return { insertId: 78 };
      return [];
    });

    const res = await request(app).put(`${PREFIX}/thresholds`).send(validPayload);

    expect(res.status).toBe(200);
    const insertSql = sqlOf(hoisted.query.mock.calls[0]);
    expect(insertSql).toContain("INSERT INTO t_platform_config");
    expect(paramsOf(hoisted.query.mock.calls[0])).toEqual([
      "SAAS",
      "platform",
      "monitor:thresholds",
      JSON.stringify({ version: 1, ...validPayload }),
      "testadmin",
    ]);
  });

  it("反测②：三档非递增（95/80/100）⇒ 400 且不落库、不留痕", async () => {
    hoisted.queryOne.mockResolvedValue({ id: 31 });

    const res = await request(app)
      .put(`${PREFIX}/thresholds`)
      .send({ ...validPayload, warnPercent: 95, alertPercent: 80 });

    expect(res.status).toBe(400);
    expect(String(res.body.msg)).toContain("递增");
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测②：缺字段（无 notify）⇒ 400 且不落库", async () => {
    const res = await request(app)
      .put(`${PREFIX}/thresholds`)
      .send({ warnPercent: 80, alertPercent: 95, blockPercent: 100 });

    expect(res.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测②：百分比越界（blockPercent=101 / warnPercent=0）⇒ 400 且不落库", async () => {
    const over = await request(app)
      .put(`${PREFIX}/thresholds`)
      .send({ ...validPayload, blockPercent: 101 });
    expect(over.status).toBe(400);

    const under = await request(app)
      .put(`${PREFIX}/thresholds`)
      .send({ ...validPayload, warnPercent: 0 });
    expect(under.status).toBe(400);
    expect(hoisted.query).not.toHaveBeenCalled();
  });

  it("反测①：GET / PUT 无令牌 ⇒ 401 且不触达数据库", async () => {
    const getRes = await request(guardedApp).get(`${PREFIX}/thresholds`);
    expect(getRes.status).toBe(401);

    const putRes = await request(guardedApp).put(`${PREFIX}/thresholds`).send(validPayload);
    expect(putRes.status).toBe(401);

    expect(hoisted.query).not.toHaveBeenCalled();
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});

describe("C4-1b 段二 A8 根因修复（platform-audit-log.service 读路径只引用真实列）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  it("listAuditLogs：SELECT 不含 user_agent / type / description 三列，改由 detail JSON 派生", async () => {
    hoisted.queryOne.mockResolvedValue({ total: 0 });
    hoisted.query.mockResolvedValue([]);

    await listAuditLogs({ page: 1, pageSize: 20 });

    const selectSql = sqlOf(hoisted.query.mock.calls[0]);
    // 三列在 DDL 中不存在（080 建表 + 153 只补 ip_address/module）⇒ 必须不出现
    expect(selectSql).not.toContain("user_agent");
    expect(selectSql).not.toContain("type, module, action, description");
    // 裸列引用（旧写法每行以列名开头）必须消失：`type,` / `description,` / `user_agent`
    expect(selectSql).not.toMatch(/^\s*(type|description|user_agent)\b/m);
    // 真实列 + 派生列
    expect(selectSql).toContain("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type')) AS type");
    expect(selectSql).toContain("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.description')) AS description");
    expect(selectSql).toContain("ip_address AS ipAddress");
    expect(selectSql).toContain("target_type AS targetType");
    expect(selectSql).toContain("module");
    expect(selectSql).toContain("created_at AS createdAt");
  });

  it("listAuditLogs：type / keyword 过滤不再引用不存在的列（改 detail JSON 表达式）", async () => {
    hoisted.queryOne.mockResolvedValue({ total: 0 });
    hoisted.query.mockResolvedValue([]);

    await listAuditLogs({ page: 1, pageSize: 20, type: "PROXY_LOGIN", keyword: "酒水" });

    const countSql = sqlOf(hoisted.queryOne.mock.calls[0]);
    expect(countSql).toContain("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type')) = ?");
    expect(countSql).toContain("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.description')) LIKE ?");
    expect(countSql).not.toContain("user_agent");
    expect(countSql).not.toMatch(/WHERE[\s\S]*\btype = \?/);
    expect(paramsOf(hoisted.queryOne.mock.calls[0])).toEqual(["PROXY_LOGIN", "%酒水%", "%酒水%", "%酒水%"]);
  });

  it("listAuditLogs：新增 action / adminName 过滤（真实列）进入 WHERE", async () => {
    hoisted.queryOne.mockResolvedValue({ total: 0 });
    hoisted.query.mockResolvedValue([]);

    await listAuditLogs({
      page: 1,
      pageSize: 20,
      action: "PROXY_LOGIN",
      adminName: "platform_admin",
      module: "tenant",
    });

    const countSql = sqlOf(hoisted.queryOne.mock.calls[0]);
    expect(countSql).toContain("admin_name = ?");
    expect(countSql).toContain("module = ?");
    expect(countSql).toContain("action = ?");
    expect(paramsOf(hoisted.queryOne.mock.calls[0])).toEqual(["platform_admin", "tenant", "PROXY_LOGIN"]);
  });

  it("返回体：移除 userAgent（无载体不填假值），type/description 从 detail 兜底派生", async () => {
    hoisted.queryOne.mockResolvedValue({ total: 1 });
    hoisted.query.mockResolvedValue([
      {
        id: 1,
        adminId: 2,
        adminName: "platform_admin",
        type: null,
        module: "tenant",
        action: "PROXY_LOGIN",
        description: null,
        targetType: "tenant",
        targetId: "t1",
        ip: "10.0.0.1",
        ipAddress: null,
        detail: JSON.stringify({ type: "PROXY_LOGIN", description: "代登录留痕" }),
        createdAt: "2026-09-24 03:00:00",
      },
    ]);

    const result = await listAuditLogs({ page: 1, pageSize: 20 });
    const row = result.records[0];

    expect(Object.prototype.hasOwnProperty.call(row, "userAgent")).toBe(false);
    expect(row.type).toBe("PROXY_LOGIN");
    expect(row.description).toBe("代登录留痕");
    expect(row.detail).toEqual({ type: "PROXY_LOGIN", description: "代登录留痕" });
    expect(row.ip).toBe("10.0.0.1");
  });

  it("getAuditLogById：同一真实列投影；不存在 ⇒ null", async () => {
    hoisted.queryOne.mockResolvedValueOnce({
      id: 9,
      adminId: 2,
      adminName: "platform_admin",
      type: null,
      module: "tenant",
      action: "PROXY_LOGIN",
      description: null,
      targetType: "tenant",
      targetId: "t1",
      ip: null,
      ipAddress: "10.0.0.2",
      detail: { type: "PROXY_LOGIN", description: "代登录留痕" },
      createdAt: "2026-09-24 03:00:00",
    });

    const found = await getAuditLogById(9);
    const sql = sqlOf(hoisted.queryOne.mock.calls[0]);

    expect(sql).toContain("WHERE id = ?");
    expect(sql).not.toContain("user_agent");
    expect(found?.ipAddress).toBe("10.0.0.2");
    expect(found?.type).toBe("PROXY_LOGIN");

    hoisted.queryOne.mockResolvedValueOnce(null);
    expect(await getAuditLogById(404)).toBeNull();
  });

  it("parseMonthRange：合法月份闭区间展开，非法即 400（不查库）", () => {
    expect(parseMonthRange("2026-02")).toEqual({
      month: "2026-02",
      dateStart: "2026-02-01",
      dateEnd: "2026-02-28",
    });
    expect(parseMonthRange("2024-02").dateEnd).toBe("2024-02-29");
    expect(() => parseMonthRange("2026-00")).toThrow();
    expect(() => parseMonthRange("2026-13")).toThrow();
    expect(() => parseMonthRange("bad")).toThrow();
  });
});
