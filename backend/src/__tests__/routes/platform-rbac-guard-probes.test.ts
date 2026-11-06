/**
 * TOTAL-PLATFORM-SERVER-SIDE-RBAC-01 · 平台 RBAC 中央守卫 路由层契约测试
 *
 * 生产同形挂载：`app.use(prefix, rateLimit, requirePlatformAuth, platformAccessGuard(), router)`
 * （与 auto-routes.setupRoutes 的 requirePlatformAuth 分支逐字同形，认证→CSRF→守卫→router，
 *   本测试不挂 csrf（其行为不在本卡判据内），顺序合规另有 auto-routes 源码形状断言兜底）。
 *
 * 覆盖判据（任务卡 §七）：
 *   A) SUPPORT 八探针全部 403（带 traceId）：
 *      空体建租户 / 合法体建租户 / toggle / 租户更新 / sysconfig 敏感读 / 管理员权限读 /
 *      AI 配置读 / open api-keys 读；
 *   B) SUPPORT 合法体写探针 ⇒ 控制器不可达（reached=0）+ 数据库零副作用
 *      （mock db 层无任何 INSERT/UPDATE/DELETE 语句被执行）；
 *   C) SUPER 对八探针端点正向兼容（到达控制器 ⇒ 200）；
 *   D) SUPPORT 五域白名单读取不误伤（dashboard / tenant 列表+详情+统计 / billing / monitor / ticket ⇒ 200）；
 *   E) 每次拒绝写平台审计（action=PERMISSION_DENIED）。
 *
 * ⚠️ 反测（mutation 点，门禁铁律 §9.1）：本文件的 403 判据全部来自
 *   middleware/platform-rbac-guard.ts + auto-routes.ts 挂载分支 —— 摘除守卫（mutation①）、
 *   误伤白名单（mutation②）、写端点放行 SUPPORT（mutation③）、摘审计留痕（mutation④）
 *   都会让对应用例点名变红。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const h = vi.hoisted(() => {
  /** 平台管理员 id → t_platform_admin.role */
  const roles = new Map<number, string>();
  /** 到达控制器的处理器名（= 守卫放行证明） */
  const reached: string[] = [];
  /** mock db 层执行过的 SQL（用于零副作用证明） */
  const executedSql: string[] = [];
  /** 审计写入入参 */
  const audits: Array<Record<string, unknown>> = [];
  /** 通用控制器桩：记录 reached 并回 200；router 级中间件桩（trackRequest）放行 next */
  const stub = (name: string) =>
    (req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }, next?: () => void) => {
      if (name === "pmon.trackRequest") {
        // 路由级 use 里以 trackRequest(); next(); 的零参形态调用 ⇒ 纯 no-op
        if (typeof next === "function") next();
        return;
      }
      reached.push(name);
      res.status(200).json({ ok: true, handler: name });
    };
  /** 按导出名清单构建桩命名空间（vitest 对 mock 命名空间做严格导出校验，不能用 Proxy） */
  const mkStubs = (prefix: string, names: readonly string[]) =>
    Object.fromEntries(names.map((n) => [n, stub(`${prefix}.${n}`)]));
  return { roles, reached, executedSql, audits, mkStubs };
});

vi.mock("../../shared/db", () => ({
  query: vi.fn(async (sql: string) => {
    h.executedSql.push(String(sql));
    return [];
  }),
  queryOne: vi.fn(async (sql: string, params?: unknown[]) => {
    h.executedSql.push(String(sql));
    if (String(sql).includes("FROM t_platform_admin")) {
      const id = Number((params as unknown[])?.[0]);
      return { role: h.roles.get(id) ?? null };
    }
    return null;
  }),
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: vi.fn(async (input: Record<string, unknown>) => {
    h.audits.push(input);
    return 1;
  }),
}));

// CSRF 行为不在本测试判据内（挂载顺序由 E) 形状断言 + auto-routes.test 冻结契约兜底），
// 这里置为直通以免写探针被 CSRF 拦截而混淆守卫判据
vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  generateCsrfToken: vi.fn(() => "stub-csrf"),
}));

vi.mock("../../middleware/auth", () => ({
  requirePlatformAuth: (req: Request, res: Response, next: NextFunction) => {
    const t = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (t !== "psuper" && t !== "psupport") {
      res.status(401).json({ code: "401", msg: "未登录", traceId: "t" });
      return;
    }
    (req as unknown as { user: unknown }).user = {
      id: t === "psuper" ? 1 : 9,
      username: t === "psuper" ? "root" : "support01",
      type: "platform_admin",
    };
    next();
  },
  requireAuth: vi.fn(),
  requireAuthWithTenant: [vi.fn()],
  signPlatformToken: vi.fn(() => "stub"),
}));

// ── 控制器全部桩化：本测试判据是「守卫是否放行到控制器」，不是控制器内部逻辑 ──
// （vitest 对 mock 命名空间做严格导出校验 ⇒ 按各路由文件实际引用的导出名逐一登记）
vi.mock("../../controllers/platform/tenant.controller", () =>
  h.mkStubs("tenant", [
    "listPlatformTenants",
    "getPlatformTenantById",
    "createPlatformTenant",
    "updatePlatformTenant",
    "togglePlatformTenantStatus",
  ])
);
vi.mock("../../controllers/platform/tenant-usage.controller", () =>
  h.mkStubs("tenant-usage", ["getUsageStatsCtrl", "getRankCtrl"])
);
vi.mock("../../controllers/platform/tenant-quota.controller", () =>
  h.mkStubs("tenant-quota", ["getTenantQuotaCtrl"])
);
vi.mock("../../controllers/platform/tenant-status-stats.controller", () =>
  h.mkStubs("tenant-status-stats", ["getTenantStatusStatsCtrl"])
);
vi.mock("../../controllers/platform/tenant-export.controller", () =>
  h.mkStubs("tenant-export", ["exportTenantsCtrl"])
);
vi.mock("../../controllers/platform/tenant-overview.controller", () =>
  h.mkStubs("tenant-overview", ["getTenantOverviewCtrl"])
);
vi.mock("../../controllers/platform/tenant-ops.controller", () =>
  h.mkStubs("tenant-ops", ["proxyLoginCtrl", "expandTenantQuotaCtrl", "resetTenantUserPasswordCtrl"])
);
vi.mock("../../controllers/platform/platform-manage.controller", () =>
  h.mkStubs("manage", ["listConfigs", "updateConfig", "getPlatformSysConfig", "updatePlatformSysConfig"])
);
vi.mock("../../controllers/platform/platform-logo.controller", () =>
  h.mkStubs("logo", ["uploadPlatformLogo"])
);
vi.mock("../../controllers/platform/platform-feature-switch.controller", () =>
  h.mkStubs("feature-switch", ["listFeatureSwitches", "updateFeatureSwitch"])
);
vi.mock("../../controllers/platform/platform-dict.controller", () =>
  h.mkStubs("dict", ["listDictTypes", "listDictItems", "replaceDictItems"])
);
vi.mock("../../controllers/platform/platform-role.controller", () =>
  h.mkStubs("role", [
    "listRoles",
    "getPermissionCatalog",
    "getRolePermissions",
    "createRole",
    "replaceRolePermissions",
    "updateRole",
    "deleteRole",
  ])
);
vi.mock("../../controllers/platform/ai-platform.controller", () =>
  h.mkStubs("ai", ["listPublicModelsCtrl", "listMeteringLogCtrl", "listAbnormalTenantsCtrl", "getModelShareCtrl"])
);
vi.mock("../../controllers/platform/platform-open-api-key.controller", () =>
  h.mkStubs("open-key", [
    "listApiKeys",
    "getApiKeyStats",
    "createApiKey",
    "updateApiKey",
    "enableApiKey",
    "rotateApiKey",
    "completeRotation",
    "deleteApiKey",
  ])
);
vi.mock("../../controllers/platform/platform-open-webhook.controller", () =>
  h.mkStubs("open-hook", [
    "listWebhooks",
    "createWebhook",
    "listEvents",
    "listDeliveries",
    "listFailures",
    "testWebhook",
    "redeliver",
    "resumeWebhook",
  ])
);
vi.mock("../../controllers/platform/dashboard.controller", () =>
  h.mkStubs("dashboard", ["getDashboard", "getTenantStats", "getRevenueStats", "getDashboardOverview"])
);
vi.mock("../../controllers/platform/platform-billing-arrears.controller", () =>
  h.mkStubs("arrears", ["listArrearsCtrl", "listAddonChargesCtrl", "urgeArrearsCtrl"])
);
vi.mock("../../controllers/platform/platform-monitor.controller", () =>
  h.mkStubs("pmon", ["trackRequest", "getMonitorStats"])
);
vi.mock("../../controllers/admin/monitor.controller", () =>
  h.mkStubs("adminmon", [
    "getDbStatusCtrl",
    "getApiStatsCtrl",
    "getExpiringTenantsCtrl",
    "notifyExpiringTenantsCtrl",
  ])
);
vi.mock("../../controllers/platform/platform-ticket.controller", () =>
  h.mkStubs("ticket", [
    "listTickets",
    "getTicket",
    "getTicketTimeline",
    "listTicketCategories",
    "getServiceReport",
    "replyTicket",
    "noteTicket",
    "transferTicket",
    "resolveTicket",
    "closeTicket",
  ])
);
vi.mock("../../controllers/platform/error-log.controller", () =>
  h.mkStubs("errorlog", ["reportPlatformFrontendError", "listPlatformErrorLogs"])
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildApp() {
  // 生产逐字挂载：auth 层（requirePlatformAuth + csrf）+ 平台守卫追加（platformMountExtras）
  // —— 与 setupRoutes 同源同函数，mutation「挂载摘除」时本文件的运行时探针同样变红
  const { getAuthMiddlewares, platformMountExtras } = await import("../../shared/auto-routes");
  const { default: rateLimit } = await import("express-rate-limit");
  const { AUTHED_ROUTE_LIMIT } = await import("../../config/rate-limit");

  // 真实路由文件（与生产同一批注册面；控制器已桩化）
  const { platformTenantRouter } = await import("../../routes/platform-tenant.routes");
  const { platformConfigRouter } = await import("../../routes/platform-config.routes");
  const { platformAdminsRouter, platformPermissionsRouter } = await import(
    "../../routes/platform-role.routes"
  );
  const { aiPlatformRouter } = await import("../../routes/ai-platform.routes");
  const { platformOpenRouter } = await import("../../routes/platform-open.routes");
  const { platformDashboardRouter } = await import("../../routes/platform-dashboard.routes");
  const { platformBillingArrearsRouter } = await import(
    "../../routes/platform-billing-arrears.routes"
  );
  const { platformMonitorRouter } = await import("../../routes/platform-monitor.routes");
  const { platformSupportRouter } = await import("../../routes/platform-ticket.routes");
  const { platformErrorLogRouter } = await import("../../routes/platform-error-log.routes");

  const app = express();
  app.use(express.json());
  // S3-119：自建 app 挂 requirePlatformAuth ⇒ 必须有内联 `.use(rateLimit(` 真实调用形态
  app.use(rateLimit(AUTHED_ROUTE_LIMIT as never));
  // 生产同形挂载（auto-routes.setupRoutes 的 requirePlatformAuth 分支）：
  // app.use(prefix, rateLimit(路由内联), requirePlatformAuth, csrfMiddleware, platformAccessGuard(), router)
  app.use(
    "/api/platform/tenants",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformTenantRouter
  );
  app.use(
    "/api/platform/config",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformConfigRouter
  );
  app.use(
    "/api/platform/admins",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformAdminsRouter
  );
  app.use(
    "/api/platform/permissions",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformPermissionsRouter
  );
  app.use(
    "/api/platform/ai",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    aiPlatformRouter
  );
  app.use(
    "/api/platform/open",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformOpenRouter
  );
  app.use(
    "/api/platform/dashboard",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformDashboardRouter
  );
  app.use(
    "/api/platform/billing",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformBillingArrearsRouter
  );
  app.use(
    "/api/platform/monitor",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformMonitorRouter
  );
  app.use(
    "/api/platform/support",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformSupportRouter
  );
  // platform-error-log.routes.ts 挂在 /api/platform 根（/error-logs 读、/error-report 写）
  app.use(
    "/api/platform",
    rateLimit(AUTHED_ROUTE_LIMIT as never),
    ...getAuthMiddlewares("requirePlatformAuth"),
    ...platformMountExtras("requirePlatformAuth"),
    platformErrorLogRouter
  );
  // 与生产同形的兜底错误处理（create-test-app 夹具同口径）：statusCode 透传，不吞栈
  app.use(
    (err: { statusCode?: number; message?: string; stack?: string }, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }, _next: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[probes-test] unhandled route error:", err?.stack || err);
      const status = err?.statusCode || 500;
      res.status(status).json({ code: String(status), msg: err?.message || "服务器内部错误" });
    }
  );
  return app;
}

/** SUPPORT 四条写探针的合法体（真实租户创建 payload 形态；控制器已桩化，仅验证放行面） */
const VALID_TENANT_BODY = {
  name: "探针租户",
  adminUsername: "probe_admin01",
  adminPassword: "Probe#12345",
  planId: 1,
};

beforeEach(() => {
  h.roles.clear();
  h.roles.set(1, "PLATFORM_SUPER_ADMIN");
  h.roles.set(9, "SUPPORT");
  h.reached.length = 0;
  h.executedSql.length = 0;
  h.audits.length = 0;
});

const SUPPORT = { Authorization: "Bearer psupport" };
const SUPER = { Authorization: "Bearer psuper" };

describe("TOTAL-RBAC 路由层 · A) SUPPORT 八探针全 403", () => {
  it("探针1/2/3/4：空体建租户、合法体建租户、toggle、租户更新 ⇒ 全部 403（带 traceId）", async () => {
    const app = await buildApp();
    const probes = [
      { fn: () => request(app).post("/api/platform/tenants").set(SUPPORT).send({}), label: "空体建租户" },
      {
        fn: () => request(app).post("/api/platform/tenants").set(SUPPORT).send(VALID_TENANT_BODY),
        label: "合法体建租户",
      },
      { fn: () => request(app).post("/api/platform/tenants/12/toggle").set(SUPPORT).send({}), label: "toggle" },
      { fn: () => request(app).put("/api/platform/tenants/12").set(SUPPORT).send({ name: "x" }), label: "租户更新" },
    ];
    for (const p of probes) {
      const res = await p.fn();
      expect(res.status, p.label).toBe(403);
      expect(res.body.code, p.label).toBe("403");
      expect(String(res.body.traceId), p.label).not.toBe("");
    }
    expect(h.reached, "控制器一次都不应被到达").toEqual([]);
  });

  it("探针5/6/7/8：sysconfig 敏感读、管理员权限读、AI 配置读、open api-keys 读 ⇒ 全部 403", async () => {
    const app = await buildApp();
    const probes = [
      { fn: () => request(app).get("/api/platform/config/sys-config").set(SUPPORT), label: "sysconfig" },
      { fn: () => request(app).get("/api/platform/admins/roles").set(SUPPORT), label: "管理员权限" },
      { fn: () => request(app).get("/api/platform/ai/public-models").set(SUPPORT), label: "AI 配置" },
      { fn: () => request(app).get("/api/platform/open/api-keys").set(SUPPORT), label: "open api-keys" },
    ];
    for (const p of probes) {
      const res = await p.fn();
      expect(res.status, p.label).toBe(403);
      expect(res.body.code, p.label).toBe("403");
      expect(String(res.body.traceId), p.label).not.toBe("");
    }
  });

  it("B) SUPPORT 写探针 ⇒ 数据库零副作用（mock db 层无任何写语句执行）+ 被拒留痕可查", async () => {
    const app = await buildApp();
    await request(app).post("/api/platform/tenants").set(SUPPORT).send(VALID_TENANT_BODY);
    await request(app).post("/api/platform/tenants/12/toggle").set(SUPPORT).send({});
    await request(app).put("/api/platform/tenants/12").set(SUPPORT).send({ name: "x" });
    const writes = h.executedSql.filter((s) =>
      /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(s)
    );
    expect(writes, `不应有任何写语句，实际: ${JSON.stringify(writes)}`).toEqual([]);
    // 被拒留痕：三条写探针各写一条 PERMISSION_DENIED 审计（module=tenant）
    const denied = h.audits.filter((a) => a.action === "PERMISSION_DENIED" && a.module === "tenant");
    expect(denied.length).toBe(3);
  });
});

describe("TOTAL-RBAC 路由层 · C) SUPER 正向兼容", () => {
  it("SUPER 对八探针端点全部放行到达控制器（200）", async () => {
    const app = await buildApp();
    const probes = [
      request(app).post("/api/platform/tenants").set(SUPER).send(VALID_TENANT_BODY),
      request(app).post("/api/platform/tenants/12/toggle").set(SUPER).send({}),
      request(app).put("/api/platform/tenants/12").set(SUPER).send({ name: "x" }),
      request(app).get("/api/platform/config/sys-config").set(SUPER),
      request(app).get("/api/platform/admins/roles").set(SUPER),
      request(app).get("/api/platform/ai/public-models").set(SUPER),
      request(app).get("/api/platform/open/api-keys").set(SUPER),
      request(app).get("/api/platform/error-logs").set(SUPER),
    ];
    for (const [i, p] of probes.entries()) {
      const res = await p;
      expect(res.status, `探针#${i}`).toBe(200);
      expect(res.body.ok).toBe(true);
    }
  });
});

describe("TOTAL-RBAC 路由层 · D) SUPPORT 白名单域读取不误伤", () => {
  it("dashboard / tenant 列表+详情+统计 / billing / monitor / ticket 读 ⇒ 200", async () => {
    const app = await buildApp();
    const probes = [
      { fn: () => request(app).get("/api/platform/dashboard").set(SUPPORT), label: "dashboard" },
      { fn: () => request(app).get("/api/platform/tenants").set(SUPPORT), label: "tenant 列表" },
      { fn: () => request(app).get("/api/platform/tenants/12").set(SUPPORT), label: "tenant 详情" },
      { fn: () => request(app).get("/api/platform/tenants/stats").set(SUPPORT), label: "tenant 统计" },
      { fn: () => request(app).get("/api/platform/billing/arrears").set(SUPPORT), label: "billing" },
      { fn: () => request(app).get("/api/platform/monitor/db-status").set(SUPPORT), label: "monitor" },
      { fn: () => request(app).get("/api/platform/support/tickets").set(SUPPORT), label: "ticket" },
    ];
    for (const p of probes) {
      const res = await p.fn();
      expect(res.status, p.label + " body=" + JSON.stringify(res.body)).toBe(200);
      expect(res.body.ok, p.label).toBe(true);
    }
  });
});

describe("TOTAL-RBAC 路由层 · E) 挂载形状（auto-routes 源码断言）", () => {
  it("setupRoutes 的 requirePlatformAuth 分支在 csrf 之后、router 之前挂 platformAccessGuard", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../shared/auto-routes.ts"),
      "utf8"
    );
    // 注册点：守卫追加在 middlewares（= requirePlatformAuth + csrf）之后、router 之前
    const register = src.match(
      /app\.use\(config\.prefix, \.\.\.middlewares, \.\.\.platformMountExtras\(config\.auth\), config\.router\)/
    );
    expect(register, "未找到 setupRoutes 注册行").not.toBeNull();
    const registerText = register![0];
    expect(registerText).toContain("platformMountExtras(config.auth)");
    // 追加函数：仅对 requirePlatformAuth 返回守卫（其余 auth 零追加，不放宽也不误伤）
    const helper = src.match(/function platformMountExtras[\s\S]*?\n\}/);
    expect(helper, "未找到 platformMountExtras 定义").not.toBeNull();
    expect(helper![0]).toContain('auth === "requirePlatformAuth"');
    expect(helper![0]).toContain("platformAccessGuard()");
  });
});
