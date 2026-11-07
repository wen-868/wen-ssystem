/**
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01 · 契约测试（路由级）
 *
 * 端点：POST /api/platform/tenants/:id/toggle（活路径，真实控制器 + 真实 service +
 * 真实统一审计入口 recordTenantToggleAudit，仅 mock shared/db / logger /
 * insertPlatformAuditLog 底座）。
 *
 * 判据（卡面 §四，7 条）：
 *  ① 成功 toggle ⇒ 200 契约不变 + 一行 TENANT_TOGGLE/SUCCESS 核对 from→to + traceId 四方一致；
 *  ② 无效状态 400 ⇒ 契约不变 + FAILED 行（invalid_status）+ 不落 UPDATE；
 *  ③ 未知租户 404 ⇒ 契约不变 + FAILED 行（tenant_not_found）+ traceId 同响应；
 *  ④ SUPPORT RBAC 403 ⇒ REJECTED 行（PERMISSION_DENIED detail.result=REJECTED）+ 无 UPDATE；
 *  ⑤ 并发双 toggle ⇒ 两行 SUCCESS、from→to 可解释、traceId 各自对应响应；
 *  ⑥ audit helper 抛错 ⇒ 业务仍成功 + error 级日志 + 失败计数可观测；
 *  ⑦ 审计内容不含敏感信息（password/token/cookie）。
 */
import { vi, describe, it, beforeEach, expect } from "vitest";
import express from "express";
import request from "supertest";

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: dbMocks.query,
  queryOne: dbMocks.queryOne,
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// 路由自带 requirePlatformAuth（判据不含 JWT 链路，夹具直置 user：见 buildApp）
vi.mock("../../middleware/auth", () => ({
  requirePlatformAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: vi.fn(),
  requireAuthWithTenant: [],
  requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  signPlatformToken: vi.fn(() => "stub"),
}));

vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  generateCsrfToken: vi.fn(() => "test-csrf"),
}));

// 底座 insertPlatformAuditLog 换成可断言的桩；统一审计入口（recordTenantToggleAudit /
// 失败计数器）在 platform-audit-tenant-toggle.service 保持**真身**，其内部调用走本桩
vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: vi.fn(async () => 1),
  listAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
}));

import { insertPlatformAuditLog } from "../../services/admin/platform-audit-log.service";
import { getTenantToggleAuditWriteFailureCount } from "../../services/admin/platform-audit-tenant-toggle.service";
import logger from "../../shared/logger";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";
import { platformAccessGuard } from "../../middleware/platform-rbac-guard";

const TID = "11111111-1111-4111-8111-111111111111";
const SUPER_USER = { id: 7, username: "super01", realName: "超管01" };

/** 守卫查到的平台角色（逐测可切） */
let guardRole: string | null = "PLATFORM_SUPER_ADMIN";
/** t_tenant 预读 SELECT 出队队列（SQL 含 tenant_name 投影，唯预读所有） */
let preSelectQueue: Array<Record<string, unknown> | null> = [];
/** t_tenant 回读 SELECT 出队队列（仅 SELECT status 投影；并发下与预读独立出队，与交错序无关） */
let readBackQueue: Array<Record<string, unknown> | null> = [];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { ...SUPER_USER, id: guardRole === "SUPPORT" ? 9 : SUPER_USER.id };
    next();
  });
  // 与生产 auto-routes 同序：认证（此处夹具直置 user）→ CSRF（判据外省略）→ 守卫 → 路由
  app.use("/api/platform/tenants", platformAccessGuard(), platformTenantRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.statusCode || 500;
    res.status(status).json({ code: String(status), msg: err?.message || "服务器内部错误", traceId: "err-trace" });
  });
  return app;
}

const app = buildApp();
const URL = `/api/platform/tenants/${TID}/toggle`;

beforeEach(() => {
  vi.clearAllMocks();
  guardRole = "PLATFORM_SUPER_ADMIN";
  preSelectQueue = [];
  readBackQueue = [];
  dbMocks.query.mockResolvedValue({ affectedRows: 1, insertId: 1 });
  dbMocks.queryOne.mockImplementation(async (sql: unknown) => {
    const s = String(sql);
    if (s.includes("t_platform_admin")) return { role: guardRole };
    if (s.includes("tenant_name AS tenantName")) return preSelectQueue.shift() ?? null;
    if (s.includes("FROM t_tenant")) return readBackQueue.shift() ?? null;
    return null;
  });
});

const toggleAuditRows = () =>
  (insertPlatformAuditLog.mock.calls as Array<[Record<string, unknown>]>)
    .map((c) => c[0])
    .filter((arg) => arg.action === "TENANT_TOGGLE");

describe("TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01 · POST /api/platform/tenants/:id/toggle 审计闭环", () => {
  it("① 成功 toggle ⇒ 200 契约不变，一行 SUCCESS 核对 ACTIVE→DISABLED，traceId 响应/审计行同值", async () => {
    preSelectQueue = [{ tenantName: "探针租户", status: 1 }];
    readBackQueue = [{ status: 0 }];

    const res = await request(app).post(URL).send({ status: "DISABLED" });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ success: true, status: "DISABLED" });
    expect(String(res.body.traceId)).not.toBe("");

    const rows = toggleAuditRows();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({
      adminId: 7,
      adminName: "super01",
      module: "tenant",
      action: "TENANT_TOGGLE",
      auditType: "TENANT_TOGGLE",
      targetType: "tenant",
      targetId: TID,
    });
    expect(row.detail).toMatchObject({
      result: "SUCCESS",
      fromStatus: "ACTIVE",
      toStatus: "DISABLED",
      targetTenantName: "探针租户",
      source: "api",
      traceId: res.body.traceId,
      duplicate: false,
    });
    // UPDATE 落库参数核对（TINYINT 0）
    const updateCall = (dbMocks.query.mock.calls as Array<[string, unknown[]]>).find((c) =>
      String(c[0]).includes("UPDATE t_tenant SET status")
    );
    expect(updateCall?.[1]).toEqual([0, TID]);
  });

  it("② 无效状态 ⇒ 400 契约不变（msg 文案逐字同旧实现），留 FAILED 行，不落任何 UPDATE", async () => {
    const res = await request(app).post(URL).send({ status: "SUSPENDED" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(res.body.msg).toBe("无效的状态值");
    expect(String(res.body.traceId)).not.toBe("");

    const rows = toggleAuditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toMatchObject({
      result: "FAILED",
      failReason: "invalid_status(400)",
      toStatus: "SUSPENDED",
      traceId: res.body.traceId,
      source: "api",
    });
    const updateCalls = (dbMocks.query.mock.calls as Array<[string]>).filter((c) =>
      String(c[0]).includes("UPDATE t_tenant")
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("③ 未知租户 ⇒ 404 契约不变，FAILED 行（tenant_not_found），traceId 同响应", async () => {
    preSelectQueue = [null];
    readBackQueue = [];

    const res = await request(app).post("/api/platform/tenants/not-exist/toggle").send({ status: "ACTIVE" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("404");
    expect(res.body.msg).toBe("租户不存在");

    const rows = toggleAuditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toMatchObject({
      result: "FAILED",
      failReason: "tenant_not_found(404)",
      fromStatus: null,
      toStatus: "ACTIVE",
      traceId: res.body.traceId,
    });
  });

  it("④ SUPPORT RBAC 403 ⇒ 守卫 REJECTED 行（PERMISSION_DENIED detail.result=REJECTED），无 UPDATE、无 TENANT_TOGGLE 行", async () => {
    guardRole = "SUPPORT";

    const res = await request(app).post(URL).send({ status: "DISABLED" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(String(res.body.traceId)).not.toBe("");

    const denied = (insertPlatformAuditLog.mock.calls as Array<[Record<string, unknown>]>)
      .map((c) => c[0])
      .filter((arg) => arg.action === "PERMISSION_DENIED");
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ adminId: 9, module: "tenant", action: "PERMISSION_DENIED" });
    expect(denied[0].detail).toMatchObject({
      result: "REJECTED",
      domain: "tenant",
      traceId: res.body.traceId,
      method: "POST",
    });
    expect(toggleAuditRows()).toHaveLength(0);
    const updateCalls = (dbMocks.query.mock.calls as Array<[string]>).filter((c) =>
      String(c[0]).includes("UPDATE t_tenant")
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("⑤ 并发双 toggle ⇒ 两行 SUCCESS（ACTIVE→DISABLED 可解释），traceId 各自对应响应", async () => {
    // 并发交错下的 SELECT 出队序：两笔预读（status=1）→ 两笔回读（status=0）
    // 并发交错下预读/回读各自独立出队（SQL 形态不同），与真实交错序无关
    preSelectQueue = [
      { tenantName: "探针租户", status: 1 },
      { tenantName: "探针租户", status: 1 },
    ];
    readBackQueue = [{ status: 0 }, { status: 0 }];

    const [r1, r2] = await Promise.all([
      request(app).post(URL).send({ status: "DISABLED" }),
      request(app).post(URL).send({ status: "DISABLED" }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.data.status).toBe("DISABLED");
    expect(r2.body.data.status).toBe("DISABLED");
    expect(r1.body.traceId).not.toBe(r2.body.traceId);

    const rows = toggleAuditRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.detail).toMatchObject({
        result: "SUCCESS",
        fromStatus: "ACTIVE",
        toStatus: "DISABLED",
        duplicate: false,
      });
    }
    const rowTraceIds = rows.map((r) => (r.detail as Record<string, unknown>).traceId);
    expect(rowTraceIds).toContain(r1.body.traceId);
    expect(rowTraceIds).toContain(r2.body.traceId);
  });

  it("⑥ audit helper 抛错 ⇒ 业务仍 200 成功 + error 级日志 + 失败计数自增（可观测）", async () => {
    (insertPlatformAuditLog as any).mockRejectedValueOnce(new Error("audit down"));
    const counterBefore = getTenantToggleAuditWriteFailureCount();
    preSelectQueue = [{ tenantName: "探针租户", status: 1 }];
    readBackQueue = [{ status: 0 }];

    const res = await request(app).post(URL).send({ status: "DISABLED" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true, status: "DISABLED" });
    expect(getTenantToggleAuditWriteFailureCount()).toBe(counterBefore + 1);
    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(errorCalls.some((m) => m.includes("[tenant-toggle-audit]"))).toBe(true);
  });

  it("⑦ 审计内容不含敏感信息（password/token/cookie 不出现）", async () => {
    preSelectQueue = [{ tenantName: "探针租户", status: 1 }];
    readBackQueue = [{ status: 0 }];

    await request(app)
      .post(URL)
      .send({ status: "DISABLED", password: "P@ssw0rd", accessToken: "should-not-leak" });

    for (const row of toggleAuditRows()) {
      const serialized = JSON.stringify(row).toLowerCase();
      expect(serialized).not.toContain("p@ssw0rd");
      expect(serialized).not.toContain("should-not-leak");
      expect(serialized).not.toMatch(/"password|cookie|accesstoken/);
    }
  });
});
