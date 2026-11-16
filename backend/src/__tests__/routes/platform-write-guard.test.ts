/**
 * MS-TOTAL-PLATFORM-SUPPORT-WRITE-GUARD-01 · 平台写端点 / 敏感读服务端权限门（目标测试）
 *
 * 覆盖判据（与派单卡 `ACTIVE-MS-TOTAL-PLATFORM-SUPPORT-WRITE-GUARD-01.md` §三 / §四 逐条对应）：
 *   ① P0 本体：`POST /api/platform/admins`（platform.routes.ts）SUPPORT ⇒ 403，
 *      且**数据库零副作用**（不出现 `INSERT INTO t_platform_admin`）；
 *   ② 同族入口：`POST /api/platform/auth/admin/create`（platform-auth.routes.ts，本卡修复点）
 *      SUPPORT ⇒ 403，同样零副作用；
 *   ③ SUPER_ADMIN（超管口径）写端点**不回退**：不被 403（到达业务层）；
 *   ④ 敏感读（sysconfig）：SUPPORT ⇒ 403；SUPER_ADMIN ⇒ 放行；
 *   ⑤ SUPPORT 白名单只读（租户列表 / 用量排行）⇒ **不**被 403（不误伤）；
 *   ⑥ 被拒请求必有审计：`t_platform_audit_log` 一条 `PERMISSION_DENIED`，且 detail 带 permCode/method/path；
 *   ⑦ 鉴权未被放宽：无令牌 ⇒ 401（权限门在认证之后）；
 *   ⑧ 反测（摘门必红）：把任一脚本点的 `requirePlatformPermission(...)` 摘掉 ⇒ 本文件的 403 断言立即点名红。
 *
 * 范式：`src/__tests__/routes/platform-rbac-pilot.test.ts`（真实 `requirePlatformAuth` + 真实 router，
 * 只把 `shared/db` 与审计 service 换成内存桩）⇒ 断言的是端点真实行为，不是 mock 自证。
 *
 * 边界（写在明处）：本文件**不改**生产代码、不连真库；「零副作用」断言的是
 * 「权限门在 controller 之前拒绝 ⇒ 业务 service 的写语句一次都没发出」这一可机检事实。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { ZodError } from "zod";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  insertPlatformAuditLog: vi.fn(),
}));

vi.mock("../../shared/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    query: hoisted.query,
    queryOne: hoisted.queryOne,
    transaction: hoisted.transaction,
    connExecute: hoisted.connExecute,
    queryWithTenant: vi.fn(),
    queryOneWithTenant: vi.fn(),
  };
});

vi.mock("../../services/admin/platform-audit-log.service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, insertPlatformAuditLog: hoisted.insertPlatformAuditLog };
});

import { env } from "../../config/env";
import {
  PLATFORM_JWT_AUDIENCE,
  PLATFORM_JWT_ISSUER,
  requirePlatformAuth,
  signPlatformToken,
} from "../../middleware/auth";
import { csrfMiddleware, generateCsrfToken } from "../../middleware/csrf";
import { platformRouter } from "../../routes/platform.routes";
import { platformAuthRouter } from "../../routes/platform-auth.routes";
import { platformConfigRouter } from "../../routes/platform-config.routes";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";
import { platformRolesRouter } from "../../routes/platform-role.routes";
import { platformSupportRouter } from "../../routes/platform-ticket.routes";

/** 探针管理员 id（与 `t_platform_admin.id` 无关：本文件 mock `shared/db`，不查真库） */
const ADMIN_ID = 77;
const CSRF = generateCsrfToken(ADMIN_ID);

function token(): string {
  return signPlatformToken({
    type: "platform_admin",
    id: ADMIN_ID,
    username: "support_probe",
  } as never);
}

/** 生产挂载形状：`app.use(prefix, requirePlatformAuth, csrfMiddleware, router)` */
function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  // 测试内自建 app 也必须显式挂限流（CodeQL `js/missing-rate-limiting` 只认注册点上内联的 rateLimit）
  app.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
  app.use("/api/platform", requirePlatformAuth, csrfMiddleware, platformRouter);
  app.use("/api/platform/auth", platformAuthRouter);
  app.use("/api/platform/config", requirePlatformAuth, csrfMiddleware, platformConfigRouter);
  app.use("/api/platform/tenants", requirePlatformAuth, csrfMiddleware, platformTenantRouter);
  app.use("/api/platform/roles", requirePlatformAuth, csrfMiddleware, platformRolesRouter);
  app.use("/api/platform/support", requirePlatformAuth, csrfMiddleware, platformSupportRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof ZodError) {
      res.status(400).json({ code: "400", msg: err.errors[0]?.message || "参数校验失败" });
      return;
    }
    res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
  });
  return app;
}

const app = buildApp();

/** 权限矩阵桩：adminRole=SUPPORT 且 support 角色无角色行 ⇒ role_not_configured ⇒ 403 */
function mockDbAsSupportWithoutRole(): void {
  hoisted.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM t_platform_admin")) return { role: "SUPPORT" } as never;
    if (sql.includes("FROM t_platform_role WHERE code")) return null as never;
    if (sql.includes("FROM t_platform_role_permission")) return null as never;
    // 业务侧读（如 createPlatformAdmin 的用户名查重）一律给空 ⇒ 若门失效会真的走到 INSERT
    return null as never;
  });
  hoisted.query.mockResolvedValue({ insertId: 1, affectedRows: 1 } as never);
}

/** 权限矩阵桩：超管口径 ⇒ 全通 */
function mockDbAsSuperAdmin(): void {
  hoisted.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM t_platform_admin")) return { role: "PLATFORM_SUPER_ADMIN" } as never;
    return null as never;
  });
  hoisted.query.mockResolvedValue({ insertId: 1, affectedRows: 1 } as never);
}

/** 本文件断言的"写语句"：出现即视为副作用 */
const WRITE_MARKERS = ["INSERT INTO t_platform_admin", "UPDATE t_platform_admin", "DELETE FROM t_platform_admin"];

function writeStatements(): string[] {
  return hoisted.query.mock.calls
    .map((c) => String(c?.[0] ?? ""))
    .filter((sql) => WRITE_MARKERS.some((m) => sql.includes(m)));
}

const VALID_ADMIN_BODY = {
  username: "probe_support_01",
  password: "Probe#12345",
  realName: "探针管理员",
  phone: "13800138000",
  role: "SUPPORT",
};

const auditCalls = (): unknown[][] => hoisted.insertPlatformAuditLog.mock.calls as unknown[][];

describe("MS-TOTAL-PLATFORM-SUPPORT-WRITE-GUARD-01 · P0 写端点权限门", () => {
  beforeEach(() => {
    hoisted.query.mockReset();
    hoisted.queryOne.mockReset();
    hoisted.transaction.mockReset();
    hoisted.connExecute.mockReset();
    hoisted.insertPlatformAuditLog.mockReset();
  });

  it("① 无令牌 ⇒ 401（既有认证未被放宽，权限门在其后）", async () => {
    mockDbAsSupportWithoutRole();
    const res = await request(app).post("/api/platform/admins").send(VALID_ADMIN_BODY);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
  });

  it("② SUPPORT 调 POST /api/platform/admins ⇒ 403 且数据库零副作用", async () => {
    mockDbAsSupportWithoutRole();
    const res = await request(app)
      .post("/api/platform/admins")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send(VALID_ADMIN_BODY);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(String(res.body.msg)).toContain("tenant:manage");
    // 零副作用：业务 service 的写语句一次都没发出（门在 controller 之前拒绝）
    expect(writeStatements()).toEqual([]);
    // 业务层断言：service 完全没被调用过 ⇒ 连用户名查重都没发生
    expect(hoisted.queryOne.mock.calls.some((c) => String(c?.[0] ?? "").includes("FROM t_platform_admin WHERE username"))).toBe(false);
  });

  it("③ SUPPORT 调 POST /api/platform/auth/admin/create（同族入口）⇒ 403 且零副作用", async () => {
    mockDbAsSupportWithoutRole();
    const res = await request(app)
      .post("/api/platform/auth/admin/create")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send(VALID_ADMIN_BODY);

    expect(res.status).toBe(403);
    expect(String(res.body.msg)).toContain("tenant:manage");
    expect(writeStatements()).toEqual([]);
  });

  it("④ SUPPORT 的其它写端点同样受控（租户创建 / 配置更新 / 角色建号）⇒ 403", async () => {
    mockDbAsSupportWithoutRole();

    const tenant = await request(app)
      .post("/api/platform/tenants")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send({ tenantName: "探针租户" });
    expect(tenant.status).toBe(403);

    const config = await request(app)
      .put("/api/platform/config")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send({});
    expect(config.status).toBe(403);

    const role = await request(app)
      .post("/api/platform/roles")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send({ name: "探针角色", code: "probe_role" });
    expect(role.status).toBe(403);
    expect(String(role.body.msg)).toContain("tenant:manage");

    expect(writeStatements()).toEqual([]);
  });

  it("⑤ 被拒请求必留审计：PERMISSION_DENIED + permCode/method/path 齐全", async () => {
    mockDbAsSupportWithoutRole();
    const res = await request(app)
      .post("/api/platform/admins")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send(VALID_ADMIN_BODY);
    expect(res.status).toBe(403);

    expect(auditCalls()).toHaveLength(1);
    expect(auditCalls()[0][0]).toMatchObject({
      adminId: ADMIN_ID,
      module: "tenant",
      action: "PERMISSION_DENIED",
      targetId: "tenant:manage",
    });
    const detail = (auditCalls()[0][0] as { detail?: Record<string, unknown> }).detail ?? {};
    expect(detail).toMatchObject({ permCode: "tenant:manage", method: "POST" });
    expect(String(detail.path ?? "")).toContain("/api/platform/admins");
  });

  it("⑥ SUPER_ADMIN 写端点不回退：不被 403（到达业务层）", async () => {
    mockDbAsSuperAdmin();
    const res = await request(app)
      .post("/api/platform/admins")
      .set("Authorization", `Bearer ${token()}`)
      .set("x-csrf-token", CSRF)
      .send(VALID_ADMIN_BODY);

    expect(res.status).not.toBe(403);
    expect(auditCalls()).toHaveLength(0);
    // 到达业务层：用户名查重已发出（后续结果由既有单测覆盖，本文件只关心"没被权限门拦"）
    expect(
      hoisted.queryOne.mock.calls.some((c) => String(c?.[0] ?? "").includes("FROM t_platform_admin WHERE username"))
    ).toBe(true);
  });

  it("⑦ 敏感读（sysconfig）SUPPORT ⇒ 403；SUPER_ADMIN ⇒ 放行", async () => {
    mockDbAsSupportWithoutRole();
    const denied = await request(app)
      .get("/api/platform/config/sys-config")
      .set("Authorization", `Bearer ${token()}`);
    expect(denied.status).toBe(403);
    expect(String(denied.body.msg)).toContain("sysconfig:view");
    expect(auditCalls()).toHaveLength(1);

    // 清掉上面那次拒绝留痕，单独断言"超管放行时不留拒绝痕迹"
    hoisted.insertPlatformAuditLog.mockClear();
    mockDbAsSuperAdmin();
    const allowed = await request(app)
      .get("/api/platform/config/sys-config")
      .set("Authorization", `Bearer ${token()}`);
    expect(allowed.status).not.toBe(403);
    expect(auditCalls()).toHaveLength(0);
  });

  it("⑧ SUPPORT 白名单只读不被误伤（租户列表 / 用量排行 / 工单看板）⇒ 非 403", async () => {
    mockDbAsSupportWithoutRole();
    hoisted.query.mockResolvedValue([] as never);

    const list = await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${token()}`);
    expect(list.status).not.toBe(403);

    const usage = await request(app)
      .get("/api/platform/tenants/usage-stats")
      .set("Authorization", `Bearer ${token()}`);
    expect(usage.status).not.toBe(403);

    // 工单只读属卡 §三.1 的 SUPPORT 白名单（dashboard / tenant / billing / monitor / ticket）
    const tickets = await request(app)
      .get("/api/platform/support/tickets")
      .set("Authorization", `Bearer ${token()}`);
    expect(tickets.status).not.toBe(403);
  });
});