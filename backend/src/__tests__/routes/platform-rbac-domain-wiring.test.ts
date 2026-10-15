/**
 * S3-219 · 平台侧 3 域（library / open / review）28 条写端点接线测试
 * （收口总清单第 67 项；台账见 `docs/tasks/R101-平台RBAC接线台账.md` §二 第 33~47 / 57~66 / 78~80 条）
 *
 * 范式：`src/__tests__/routes/ai-platform.test.ts`（真实 `requirePlatformAuth` + `signPlatformToken`）
 *   ＋ `src/__tests__/middleware/platform-rbac.test.ts`（按 SQL 内容分派 `shared/db` mock）。
 *
 * 与既有平台域测试的两点差异（本单要求）：
 *   ① **挂载照抄生产**：用 `getAuthMiddlewares(routeConfig.auth)` 逐文件挂载（auth + csrf 来自
 *      `routeConfig` 声明），不手写一套中间件顺序 —— 避免"测试绿、生产 401/403"的契约错配；
 *   ② **端点清单由真实 router 栈派生**（不手抄）：新增/删除写端点会让本文件的 28 条断言立刻漂移报红，
 *      而不是"清单写死、代码改了测试仍绿"。
 *
 * 两侧反测（派单卡 §五.3）：
 *   ① 无该码（矩阵 can_page_btn=0）⇒ **403**，且响应文案含该权限码、拒绝留痕 1 条；
 *   ② 有该码（can_page_btn=1）⇒ **不再 403**，且**无**拒绝留痕；
 *   ③ 三态分辨力（同一端点）：缺令牌 ⇒ 401（认证层）／缺 CSRF ⇒ 403 且文案含 CSRF（CSRF 层）／
 *      令牌+CSRF+无码 ⇒ 403 且文案含权限码（授权层）—— 证明三条断言分别落在不同的门上；
 *   ④ 「摘掉中间件 ⇒ 必红」的实跑证据（临时删一条 `requirePlatformPermission`）见
 *      `docs/evidence/S3-219/`（不把恒红用例留在仓库里）。
 *
 * 边界（写在这里，不藏着）：本文件**不覆盖** GET 读端点是否该接读码（第 67 项范围＝写端点，同 S3-193 口径），
 *   只断言「本次没有顺手把写码挂到读端点上」（读端点在此仍是放行态）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import type { Router } from "express";
import { ZodError } from "zod";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: hoisted.audit,
}));

import {
  platformLibraryRouter,
  routeConfig as libraryRouteConfig,
} from "../../routes/platform-library.routes";
import {
  platformOpenRouter,
  routeConfig as openRouteConfig,
} from "../../routes/platform-open.routes";
import {
  platformReviewRouter,
  routeConfig as reviewRouteConfig,
} from "../../routes/platform-review.routes";
import { requirePlatformAuth, signPlatformToken } from "../../middleware/auth";
import { csrfMiddleware, generateCsrfToken } from "../../middleware/csrf";
import { PLATFORM_PERMISSIONS, resolvePlatformPermission } from "../../middleware/platform-rbac";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { PERMISSION_CATALOG } from "../../services/platform/platform-role.service";

/** 测试用平台管理员 id（与 `t_platform_admin.id` 无关：本文件 mock `shared/db`，不查真库） */
const ADMIN_ID = 9;
/** 真实签发的平台 JWT（issuer/audience 与生产一致） */
const PLATFORM_TOKEN = signPlatformToken({
  type: "platform_admin",
  id: ADMIN_ID,
  username: "s3219_rbac_test",
});
/** 真实 CSRF 令牌（与 `csrfMiddleware` 同一算法，subject = 管理员 id） */
const CSRF_TOKEN = generateCsrfToken(ADMIN_ID);

/** 生产挂载形状：`app.use(prefix, ...getAuthMiddlewares(routeConfig.auth), router)` */
const app = express();
app.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流（CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`）
app.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限：避免用例之间互相触发 429
for (const config of [libraryRouteConfig, openRouteConfig, reviewRouteConfig]) {
  app.use(config.prefix, ...getAuthMiddlewares(config.auth), config.router);
}
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ZodError) {
    res.status(400).json({ code: "400", msg: err.errors[0]?.message || "参数校验失败" });
    return;
  }
  const status = err?.statusCode || 500;
  res.status(status).json({ code: String(status), msg: err?.message || "服务器内部错误" });
});

interface DomainSuite {
  /** 域（用于失败信息定位） */
  name: string;
  prefix: string;
  router: Router;
  permCode: string;
  moduleCode: string;
  /** 台账 §一 的端点数（本批 = 15 / 10 / 3） */
  expected: number;
}

const SUITES: DomainSuite[] = [
  {
    name: "library 商品库",
    prefix: libraryRouteConfig.prefix,
    router: platformLibraryRouter,
    permCode: "library:manage",
    moduleCode: "library",
    expected: 15,
  },
  {
    name: "open 开放平台",
    prefix: openRouteConfig.prefix,
    router: platformOpenRouter,
    permCode: "open:manage",
    moduleCode: "open",
    expected: 10,
  },
  {
    name: "review 平台评价与审核",
    prefix: reviewRouteConfig.prefix,
    router: platformReviewRouter,
    permCode: "review:manage",
    moduleCode: "review",
    expected: 3,
  },
];

interface Endpoint {
  suite: DomainSuite;
  method: string;
  /** router 内声明路径（含 `:param`） */
  subPath: string;
  /** 完整路径（prefix + subPath），与台账 §二 的"完整路径"同口径 */
  fullPath: string;
  /** 可直接发请求的具体 URL（`:param` → `1`） */
  url: string;
}

const WRITE_METHODS = ["post", "put", "patch", "delete"];
const ROUTE_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

/** 从真实 router 栈列出写端点（与 G4 门禁/台账同一判据：源码声明数） */
function routesOf(suite: DomainSuite): Endpoint[] {
  const out: Endpoint[] = [];
  const stack = (suite.router as unknown as { stack?: unknown[] }).stack ?? [];
  for (const layer of stack as Array<{
    route?: { path?: string; methods?: Record<string, boolean> };
  }>) {
    const route = layer?.route;
    if (!route) continue;
    const subPath = route.path ?? "";
    for (const [method, enabled] of Object.entries(route.methods ?? {})) {
      if (!enabled || !ROUTE_METHODS.includes(method)) continue;
      if (!WRITE_METHODS.includes(method)) continue;
      out.push({
        suite,
        method: method.toUpperCase(),
        subPath,
        fullPath: `${suite.prefix.replace(/\/$/, "")}${subPath}`,
        url: `${suite.prefix.replace(/\/$/, "")}${subPath.replace(/:[A-Za-z0-9_]+/g, "1")}`,
      });
    }
  }
  return out;
}

const ALL: Endpoint[] = SUITES.flatMap(routesOf);

/** 从真实 router 栈列出读端点（本单的"范围边界"断言用） */
function readPathsOf(suite: DomainSuite): string[] {
  const out: string[] = [];
  const stack = (suite.router as unknown as { stack?: unknown[] }).stack ?? [];
  for (const layer of stack as Array<{
    route?: { path?: string; methods?: Record<string, boolean> };
  }>) {
    const route = layer?.route;
    if (!route?.methods?.get) continue;
    const subPath = route.path ?? "";
    out.push(`${suite.prefix.replace(/\/$/, "")}${subPath || "/"}`);
  }
  return out;
}

/** 按 SQL 内容分派 mock（不改调用顺序，避免实现细节变动把用例带偏） */
function setupDb(options: {
  /** `t_platform_admin.role` 取值 */
  adminRole?: string | null;
  /** `t_platform_role` 命中行 */
  roleRow?: { id: number; code: string } | null;
  /** `t_platform_role_permission` 命中的矩阵单元（null ⇒ 无该行） */
  matrix?: { canMenu: number; canPageBtn: number } | null;
}): void {
  hoisted.query.mockReset();
  hoisted.queryOne.mockReset();
  hoisted.audit.mockReset();
  hoisted.query.mockResolvedValue([] as never);
  hoisted.queryOne.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM t_platform_admin")) {
      return options.adminRole === undefined ? null : ({ role: options.adminRole } as never);
    }
    if (sql.includes("FROM t_platform_role WHERE code")) {
      return (options.roleRow ?? null) as never;
    }
    if (sql.includes("FROM t_platform_role_permission")) {
      return (options.matrix ?? null) as never;
    }
    // 其余查询（controller/service 的库读）一律给空值：本文件只关心权限闸门，
    // 放行侧只要"没被 403 拦住"即可（业务结果由各域既有用例负责）
    return null as never;
  });
}

/** 无该码：角色 support 命中角色行，但 library/open/review 域 can_page_btn = 0 */
function setupDeny(): void {
  setupDb({
    adminRole: "SUPPORT",
    roleRow: { id: 3, code: "support" },
    matrix: { canMenu: 0, canPageBtn: 0 },
  });
}

/** 有该码：同角色，矩阵 can_page_btn = 1 */
function setupAllow(): void {
  setupDb({
    adminRole: "SUPPORT",
    roleRow: { id: 3, code: "support" },
    matrix: { canMenu: 1, canPageBtn: 1 },
  });
}

function call(endpoint: Endpoint, withCsrf = true) {
  const req = (request(app) as unknown as Record<string, (url: string) => any>)[
    endpoint.method.toLowerCase()
  ](endpoint.url);
  req.set("Authorization", `Bearer ${PLATFORM_TOKEN}`);
  if (withCsrf) req.set("x-csrf-token", CSRF_TOKEN);
  return req.send({});
}

const auditCalls = (): unknown[][] => hoisted.audit.mock.calls as unknown[][];

describe("S3-219 · 端点清单与权限码登记（台账 §二 逐条对齐）", () => {
  it("三个路由文件都是**声明式**鉴权（auth 由 routeConfig 提供 auth + CSRF，不在 router 内自造）", () => {
    for (const config of [libraryRouteConfig, openRouteConfig, reviewRouteConfig]) {
      expect(getAuthMiddlewares(config.auth)).toEqual([requirePlatformAuth, csrfMiddleware]);
    }
  });

  it("3 域写端点数为 library 15 ／ open 10 ／ review 3 ＝ 28 条", () => {
    expect(SUITES.map((s) => routesOf(s).length)).toEqual(SUITES.map((s) => s.expected));
    expect(ALL).toHaveLength(28);
  });

  it("每条端点的权限码已登记，且 level=WRITE、catalogReady=true（目录扩的实证）", () => {
    for (const endpoint of ALL) {
      const spec = resolvePlatformPermission(endpoint.suite.permCode);
      expect(spec.moduleCode, endpoint.fullPath).toBe(endpoint.suite.moduleCode);
      expect(spec.level, endpoint.fullPath).toBe("WRITE");
      // catalogReady=false 的码在角色矩阵里**无法被授予**（platform-role.service 对目录外域 400）
      // ⇒ 若这里为 false，接线等于"除超管外永久 403"，属静默失效
      expect(spec.catalogReady, endpoint.fullPath).toBe(true);
    }
  });

  it("catalogReady 与平台侧目录同源（防两处漂移：8 域 → 11 域、18 条 → 21 条）", () => {
    const catalogModules = new Set(PERMISSION_CATALOG.map((entry) => entry.moduleCode));
    expect([...catalogModules].sort()).toEqual([
      "ai",
      "billing",
      "common",
      "library",
      "marketing",
      "monitor",
      "open",
      "review",
      "sysconfig",
      "tenant",
      "ticket",
    ]);
    for (const [code, spec] of PLATFORM_PERMISSIONS) {
      expect(spec.catalogReady, code).toBe(catalogModules.has(spec.moduleCode));
    }
  });
});

describe.each(ALL.map((endpoint) => [`${endpoint.method} ${endpoint.fullPath}`, endpoint] as [string, Endpoint]))(
  "S3-219 · %s",
  (_label, endpoint) => {
    beforeEach(() => {
      setupDeny();
    });

    it(`① 无该码（${endpoint.suite.permCode} 的 can_page_btn=0）⇒ 403 + 拒绝留痕`, async () => {
      const res = await call(endpoint);
      expect(res.status).toBe(403);
      // 分辨力：这条文案只有平台权限中间件会产出（CSRF 层文案是"CSRF token 无效或缺失"）
      expect(String(res.body.msg)).toContain(endpoint.suite.permCode);
      expect(auditCalls()).toHaveLength(1);
      expect(auditCalls()[0][0]).toMatchObject({
        adminId: ADMIN_ID,
        module: endpoint.suite.moduleCode,
        action: "PERMISSION_DENIED",
      });
    });

    it("② 有该码 ⇒ 放行（不再 403、无拒绝留痕）", async () => {
      setupAllow();
      const res = await call(endpoint);
      expect(res.status).not.toBe(403);
      expect(String(res.body?.msg ?? "")).not.toContain(endpoint.suite.permCode);
      expect(auditCalls()).toHaveLength(0);
    });
  }
);

describe("S3-219 · 三态分辨力（同一端点：认证层 / CSRF 层 / 授权层）", () => {
  const sample = ALL.find(
    (endpoint) => endpoint.method === "POST" && endpoint.suite.moduleCode === "library"
  )!;

  it("端点清单非空（抽样端点存在）", () => {
    expect(sample).toBeTruthy();
  });

  it("缺令牌 ⇒ 401（认证层拦下，权限层不参与）", async () => {
    setupDeny();
    const res = await (request(app) as any)[sample.method.toLowerCase()](sample.url).send({});
    expect(res.status).toBe(401);
    expect(auditCalls()).toHaveLength(0);
  });

  it("有令牌但缺 CSRF ⇒ 403 且文案指向 CSRF（证明声明式 CSRF 确实在链上）", async () => {
    setupAllow();
    const res = await call(sample, false);
    expect(res.status).toBe(403);
    expect(String(res.body.msg)).toContain("CSRF");
    expect(auditCalls()).toHaveLength(0);
  });

  it("令牌+CSRF 齐全但无该码 ⇒ 403 且文案指向权限码（授权层，不是 CSRF 层）", async () => {
    setupDeny();
    const res = await call(sample);
    expect(res.status).toBe(403);
    expect(String(res.body.msg)).toContain(sample.suite.permCode);
    expect(String(res.body.msg)).not.toContain("CSRF");
  });
});

describe("S3-219 · 范围边界：本单只接写端点（未顺手给读端点挂写码）", () => {
  it.each(SUITES.map((suite) => [suite.name, suite] as [string, DomainSuite]))(
    "%s 的 GET 读端点在无写码时**不**被 403（读码属后续批次）",
    async (_name, suite) => {
      setupDeny();
      const [readPath] = readPathsOf(suite);
      expect(readPath, `${suite.name} 无 GET 读端点，断言失去意义`).toBeTruthy();
      const res = await request(app)
        .get(readPath)
        .set("Authorization", `Bearer ${PLATFORM_TOKEN}`);
      expect(res.status).not.toBe(403);
      expect(auditCalls()).toHaveLength(0);
    }
  );
});
