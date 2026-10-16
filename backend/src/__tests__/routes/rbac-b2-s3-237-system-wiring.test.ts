/**
 * S3-237 · 接线批 10 · **组 1「系统设置 / 基础域」10 条接线 + 4 条「不接」判定** 验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-237.md` §一 组 1｜码表：`backend/src/shared/system-permission-codes.ts`
 * （S3-232 立码，迁移 `docs/migrations/204_系统设置域权限点立码.sql`）｜授权模型不变量 **I1'**
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §二十｜证据：`docs/evidence/S3-237/`
 *
 * 本文件要证明的六件事：
 *  a) **10 条**注册行自带 `requirePermission(...)`（注册行级判据，踩坑[134]：注释不算），
 *     且常量↔码一一对应（`SYSTEM_PERMISSION_CATALOG` 是唯一出处，端点字面量逐条比对）；
 *  b) **缺码 / 非持有人 ⇒ 403** 且**未到达业务层**（证明不是恒 true 的假门禁）；
 *  c) **持有人 ⇒ 200**（超管持 `*`；`SUPER_ADMIN` 走 `rbac-auth.ts:13` 的快速通道）；
 *  d) **未登录 ⇒ 401**（既有行为不变）；
 *  e) **4 条通知写端点确实"没接"**：注册行不含 `requirePermission(`，且 READONLY 仍**到达业务层**；
 *     同时给出"为什么不接"的**可复算证据**（手机端消息页无权限门 + 在用角色不持码）；
 *  f) **`push/test` 与控制器角色白名单逐条对齐**（无"码放行、控制器 403"的空转，也无在用账号被新门拦下）。
 *
 * 判据来源：权限匹配用**生产同一份** `services/admin/rbac.service.ts` 的 `matchPermission`；
 *   角色权限串 = 生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt`（租户 `default`，
 *   `STORE_MANAGER` 行按该文件顶部凌舟的 **204 过期批注**叠加 `goods:create|edit`）。
 *
 * 反测（门禁铁律）：摘掉任一条的 `requirePermission(...)`（本文件取中间的 `POST /api/admin/archive/execute`）
 *   ⇒ 形状断言与「非持有人 ⇒ 403」用例必红；复原 ⇒ 绿（原始输出见 `docs/evidence/S3-237/`）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { fail } from "../../shared/response";

const h = vi.hoisted(() => {
  /** 控制器被调用的记录（= 请求到达业务层） */
  const reached: string[] = [];
  /** userId → 角色权限串（等价于 t_sys_role.permissions） */
  const perms = new Map<number, string[]>();
  const stub = () => {
    const cache = new Map<string, unknown>();
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") return undefined;
          const key = String(prop);
          if (!cache.has(key)) {
            cache.set(key, (req: any, res: any) => {
              reached.push(key);
              res.json({ success: true, code: "0", msg: "成功", handler: key });
            });
          }
          return cache.get(key);
        },
        has(_t, prop) {
          return typeof prop !== "symbol";
        },
      }
    );
  };
  return { reached, perms, stub };
});

vi.mock("@controllers/admin/alert.controller", () => h.stub());
vi.mock("@controllers/admin/archive.controller", () => h.stub());
vi.mock("@controllers/admin/notification.controller", () => h.stub());
vi.mock("@controllers/admin/push.controller", () => h.stub());
vi.mock("@controllers/admin/sms-template.controller", () => h.stub());
vi.mock("@controllers/admin/system.controller", () => h.stub());

vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { SYSTEM_PERMISSION_CATALOG } from "../../shared/system-permission-codes";
import { alertRouter } from "../../routes/alert.routes";
import { archiveRouter } from "../../routes/archive.routes";
import { adminNotificationRouter } from "../../routes/notification.routes";
import { pushRouter } from "../../routes/push.routes";
import { smsTemplateRouter } from "../../routes/sms-template.routes";
import { systemRouter } from "../../routes/system.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

type Method = "post" | "put" | "delete";

/**
 * 测试账号：权限串 = **生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default`）。
 * `accounts` = 生产绑定账号数（`R101-授权模型提案-凌舟-20261016.md` §一）：只约束**在用**角色（不变量 I1'）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; accounts: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], accounts: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], accounts: 2 },
  9003: {
    name: "store_manager",
    roles: ["STORE_MANAGER"],
    // 生产实值 + 204 批注（凌舟 2026-10-16：`goods:create` / `goods:edit` 已由 D1 授予全部租户店长）
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle", "goods:create", "goods:edit"],
    accounts: 1,
  },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"], accounts: 1 },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"], accounts: 0 },
  9006: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"], accounts: 0 },
  9007: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"], accounts: 0 },
  9008: { name: "finance_staff", roles: ["FINANCE_STAFF"], perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"], accounts: 0 },
  9009: { name: "customer_service", roles: ["CUSTOMER_SERVICE"], perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"], accounts: 0 },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], accounts: 0 },
};

const SUPER_ADMIN = 9002;
const STORE_MANAGER = 9003;
const STORE_OPERATOR = 9004;
const READONLY = 9001;
const OPERATION_ADMIN = 9010;

interface Row {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  controller: string;
  perm: string;
  /** 注册行里应出现的常量标识符（`system-permission-codes.ts` 导出名） */
  constName: string;
}

const ALERTS = "/api/admin/alerts";
const ARCHIVE = "/api/admin/archive";
const NOTIFICATIONS = "/api/admin/notifications";
const PUSH = "/api/admin/push";
const SMS = "/api/admin/sms-templates";
const SYSTEM = "/api/system";

/** 本批组 1 已接 **10 行**（`alert` 3 / `archive` 1 / `notifications` 1 / `push` 1 / `sms-template` 3 / `system` 1） */
const ROWS: Row[] = [
  { file: "alert.routes.ts", prefix: ALERTS, router: alertRouter, method: "put", routePath: "/:id/handle", path: "/1/handle", controller: "handleAlert", perm: "system:alert:handle", constName: "PERM_SYSTEM_ALERT_HANDLE" },
  { file: "alert.routes.ts", prefix: ALERTS, router: alertRouter, method: "put", routePath: "/rules/:id", path: "/rules/1", controller: "updateAlertRule", perm: "system:alert:rule-edit", constName: "PERM_SYSTEM_ALERT_RULE_EDIT" },
  { file: "alert.routes.ts", prefix: ALERTS, router: alertRouter, method: "post", routePath: "/check", path: "/check", controller: "runCheck", perm: "system:alert:check", constName: "PERM_SYSTEM_ALERT_CHECK" },
  { file: "archive.routes.ts", prefix: ARCHIVE, router: archiveRouter, method: "post", routePath: "/execute", path: "/execute", controller: "executeArchive", perm: "system:archive:execute", constName: "PERM_SYSTEM_ARCHIVE_EXECUTE" },
  { file: "notification.routes.ts", prefix: NOTIFICATIONS, router: adminNotificationRouter, method: "post", routePath: "/send", path: "/send", controller: "send", perm: "system:notification:send", constName: "PERM_SYSTEM_NOTIFICATION_SEND" },
  { file: "push.routes.ts", prefix: PUSH, router: pushRouter, method: "post", routePath: "/test", path: "/test", controller: "sendTestPush", perm: "system:push:test", constName: "PERM_SYSTEM_PUSH_TEST" },
  { file: "sms-template.routes.ts", prefix: SMS, router: smsTemplateRouter, method: "post", routePath: "/", path: "/", controller: "handleCreateSmsTemplate", perm: "system:sms-template:create", constName: "PERM_SYSTEM_SMS_TEMPLATE_CREATE" },
  { file: "sms-template.routes.ts", prefix: SMS, router: smsTemplateRouter, method: "put", routePath: "/:id", path: "/1", controller: "handleUpdateSmsTemplate", perm: "system:sms-template:edit", constName: "PERM_SYSTEM_SMS_TEMPLATE_EDIT" },
  { file: "sms-template.routes.ts", prefix: SMS, router: smsTemplateRouter, method: "delete", routePath: "/:id", path: "/1", controller: "handleDeleteSmsTemplate", perm: "system:sms-template:delete", constName: "PERM_SYSTEM_SMS_TEMPLATE_DELETE" },
  { file: "system.routes.ts", prefix: SYSTEM, router: systemRouter, method: "post", routePath: "/migrate", path: "/migrate", controller: "runSystemMigration", perm: "system:migration:run", constName: "PERM_SYSTEM_MIGRATION_RUN" },
];

/** 本批**不接**的 4 行（同文件、同前缀；判据见 e 组用例） */
const NOT_WIRED: { method: Method; routePath: string; path: string }[] = [
  { method: "put", routePath: "/:id/read", path: "/1/read" },
  { method: "post", routePath: "/read-all", path: "/read-all" },
  { method: "delete", routePath: "/:id", path: "/1" },
  { method: "post", routePath: "/batch-delete", path: "/batch-delete" },
];

function buildApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const uid = Number(req.headers["x-test-user"]);
    if (uid) {
      const u = USERS[uid];
      (req as any).user = { id: uid, roles: u.roles, tenantId: 1, storeId: 1 };
      (req as any).tenantId = 1;
    }
    next();
  });
  // 与生产一致：CSRF 在鉴权之后、控制器之前
  app.use((req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).user?.id;
    if (!uid) return next();
    const token = req.headers["x-csrf-token"];
    if (!token || token !== generateCsrfToken(uid)) {
      res.status(403).json(fail("CSRF token 无效或缺失", "403"));
      return;
    }
    next();
  });
  app.use(prefix, router);
  return app;
}

const APPS = new Map<string, express.Express>();
function appFor(prefix: string, router: Router) {
  const key = prefix;
  if (!APPS.has(key)) APPS.set(key, buildApp(prefix, router));
  return APPS.get(key)!;
}

function call(row: { prefix: string; router: Router; method: Method; path: string }, uid?: number) {
  const req = request(appFor(row.prefix, row.router))[row.method](`${row.prefix}${row.path}`);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

/** 取某文件里「注册某方法＋某路径模式」的**行**（跳过注释行）——踩坑[134] */
function registrationLines(file: string, method: Method, routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

function label(row: { file?: string; method: Method; routePath: string; perm?: string }) {
  return `${row.file ?? "notification.routes.ts"} ${row.method.toUpperCase()} ${row.routePath}${row.perm ? ` ⇒ ${row.perm}` : ""}`;
}

function holdersOf(perm: string): number[] {
  return Object.keys(USERS).map(Number).filter((uid) => matchPermission(USERS[uid].perms, perm)).sort((a, b) => a - b);
}
function nonHoldersOf(perm: string): number[] {
  const s = new Set(holdersOf(perm));
  return Object.keys(USERS).map(Number).filter((uid) => !s.has(uid)).sort((a, b) => a - b);
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("S3-237 组 1 · 名单自证", () => {
  it("10 行（alert 3 / archive 1 / notifications 1 / push 1 / sms-template 3 / system 1），码两两不同", () => {
    expect(ROWS).toHaveLength(10);
    expect(new Set(ROWS.map((r) => r.perm)).size).toBe(10);
    expect(new Set(ROWS.map((r) => `${r.file} ${r.method} ${r.routePath}`)).size).toBe(10);
  });

  it("10 个码**全部**是 S3-232 已立的新码（迁移 204 ↔ 目录同源），本批不新立码、不改角色种子", () => {
    const catalogCodes = new Set(SYSTEM_PERMISSION_CATALOG.map((e) => e.code));
    for (const r of ROWS) {
      expect(catalogCodes.has(r.perm), `${r.perm} 必须在 system-permission-codes.ts 目录里`).toBe(true);
    }
    // 目录侧端点字面量与本文件的注册行逐条对齐（防"目录改了、路由没改"）
    for (const r of ROWS) {
      const entry = SYSTEM_PERMISSION_CATALOG.find((e) => e.code === r.perm)!;
      expect(entry.routeFile).toBe(r.file);
      expect(entry.endpoints).toContain(`${r.method.toUpperCase()} ${r.prefix}${r.routePath}`);
    }
  });
});

describe("S3-237 组 1 · a) 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$file $method $routePath：注册行自带 requirePermission($constName)", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 应带 requirePermission(${row.constName})`).toContain(`requirePermission(${row.constName})`);
    }
  });

  it("常量标识符 ↔ 权限码一一对应（防「接错常量」）", () => {
    const src = readFileSync(path.join(REPO_ROOT, "backend/src/shared/system-permission-codes.ts"), "utf8");
    for (const row of ROWS) {
      const re = new RegExp(`export const ${row.constName}\\s*=\\s*"([^"]+)"`);
      const m = src.match(re);
      expect(m, `${row.constName} 必须在 system-permission-codes.ts 里导出`).not.toBeNull();
      expect(m![1]).toBe(row.perm);
    }
  });
});

describe("S3-237 组 1 · b) 缺码 / 非持有人 ⇒ 403 且未到达业务层", () => {
  it.each(ROWS)("$file $method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    h.reached.length = 0;
    const res = await call(row, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$file $method $routePath：全部非持有人（逐账号枚举）⇒ 403 且不得到达业务层", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row, uid);
      expect(res.status, `${USERS[uid].name} 不应通过 ${label(row)}`).toBe(403);
      expect(res.body.msg, label(row)).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("S3-237 组 1 · c) 有码 ⇒ 200（含在用角色）", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.handler).toBe(row.controller);
      expect(h.reached.length).toBeGreaterThan(0);
    }
  });

  it("10 个码的持有人集合 = {SUPER_ADMIN(2 账号), OPERATION_ADMIN(0 账号)}，且**无任何在用写角色**被误挡", () => {
    for (const row of ROWS) {
      expect(holdersOf(row.perm), row.perm).toEqual([SUPER_ADMIN, OPERATION_ADMIN].sort((a, b) => a - b));
    }
  });

  it("域通配不跨域：店长 `store:*`/`sale:*`/`customer:*`/`inventory:*`/`report:*`/`dashboard:*` 均**不**命中 `system:*`", () => {
    for (const perm of [`store:*`, `sale:*`, `customer:*`, `inventory:*`, `report:*`, `dashboard:*`]) {
      expect(matchPermission([perm], "system:notification:send")).toBe(false);
      expect(matchPermission([perm], "system:alert:handle")).toBe(false);
    }
    // 分辨力：`system:*` 自己命中；`*:view` 只覆盖 view 动作
    expect(matchPermission(["system:*"], "system:notification:send")).toBe(true);
    expect(matchPermission(["*:view"], "system:notification:send")).toBe(false);
    expect(matchPermission(["*:view"], "system:notification:view")).toBe(true);
  });
});

describe("S3-237 组 1 · d) 未登录 ⇒ 401（既有行为不变）", () => {
  it.each(ROWS)("$file $method $routePath：无登录态 ⇒ 401", async (row) => {
    const res = await request(appFor(row.prefix, row.router))[row.method](`${row.prefix}${row.path}`).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-237 组 1 · e) 4 条通知写端点**确实没接**（不接判定可复算）", () => {
  it.each(NOT_WIRED)("$method $routePath：注册行**不含** requirePermission(（没多接、没偷接）", (row) => {
    const lines = registrationLines("notification.routes.ts", row.method, row.routePath);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `notification.routes.ts:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
  });

  it.each(NOT_WIRED)("$method $routePath：READONLY 仍**到达业务层**（未接线态被显式锁定）", async (row) => {
    h.reached.length = 0;
    const res = await call({ prefix: NOTIFICATIONS, router: adminNotificationRouter, method: row.method, path: row.path }, READONLY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("不接理由①：手机端消息页**无权限门**（`permission-gates.ts` 全表 0 处引用 `/api/admin/notifications`）", () => {
    const gates = readFileSync(path.join(REPO_ROOT, "app-mobile/src/config/permission-gates.ts"), "utf8");
    expect(gates).not.toMatch(/\/api\/admin\/notifications/);
    expect(gates).not.toMatch(/notifications\/notifications\.vue/);
  });

  it("不接理由②：手机端消息页入口**无条件渲染**（首页铃铛图标 + 页面真实调用点）", () => {
    const home = readFileSync(path.join(REPO_ROOT, "app-mobile/src/pages/home/home.vue"), "utf8");
    // 铃铛入口所在行不得带权限门判定（v-if 只用于未读小红点）
    const bellLine = home.split(/\r?\n/).find((l) => l.includes("/pages/notifications/notifications"))!;
    expect(bellLine).toBeTruthy();
    expect(bellLine).not.toMatch(/v-if|v-show|canAccess|hasPermission|permissionGate|isPageVisible/i);

    const page = readFileSync(path.join(REPO_ROOT, "app-mobile/src/pages/notifications/notifications.vue"), "utf8");
    for (const callSign of ["notificationsApi.markRead(", "notificationsApi.markAllRead(", "notificationsApi.delete(", "notificationsApi.batchDelete("]) {
      expect(page, `消息页应真实调用 ${callSign}`).toContain(callSign);
    }
  });

  it("不接理由③：在用角色（店长 1 账号 / 操作员 1 账号）**不持** `system:notification:*` 任何一条 ⇒ 接线即 403 回归", () => {
    const codes = [
      "system:notification:read",
      "system:notification:read-all",
      "system:notification:delete",
      "system:notification:batch-delete",
    ];
    for (const code of codes) {
      for (const uid of [STORE_MANAGER, STORE_OPERATOR]) {
        expect(matchPermission(USERS[uid].perms, code), `${USERS[uid].name} 不应持有 ${code}`).toBe(false);
      }
      // 且在用账号数必须为 0 才允许"接线不管"——这里恰好不为 0 ⇒ I1' 三条都不成立 ⇒ 不接
      expect(USERS[STORE_MANAGER].accounts).toBeGreaterThan(0);
      expect(USERS[STORE_OPERATOR].accounts).toBeGreaterThan(0);
    }
  });
});

describe("S3-237 组 1 · f) push/test 与控制器角色白名单逐条对齐（无空转、无在用账号被拦）", () => {
  const controllerSrc = () => readFileSync(path.join(REPO_ROOT, "backend/src/controllers/admin/push.controller.ts"), "utf8");

  it("控制器白名单源文本 = SUPER_ADMIN / OPERATION_ADMIN / BOSS（接线前后一字未改）", () => {
    expect(controllerSrc()).toContain('hasAnyRole(user, ["SUPER_ADMIN", "OPERATION_ADMIN", "BOSS"])');
  });

  it("码的持有人集合 ⊆ 控制器白名单 ⇒ 不存在「码放行、控制器仍 403」的空转", () => {
    const whitelist = ["SUPER_ADMIN", "OPERATION_ADMIN", "BOSS"];
    const holders = holdersOf("system:push:test");
    expect(holders.length).toBeGreaterThan(0);
    for (const uid of holders) {
      // 持有人必是 `*` 通配角色；逐个断言其角色名在白名单内（本用例 9002 / 9010 两个账号覆盖到位）
      for (const role of USERS[uid].roles) {
        expect(whitelist, `${USERS[uid].name} 的角色 ${role} 应在控制器白名单内`).toContain(role);
      }
    }
  });

  it("白名单里多出的 `BOSS` 在生产角色表**不存在**（底稿 12 角色无 BOSS）⇒ 没有在用账号被新门拦下", () => {
    const prod = readFileSync(path.join(REPO_ROOT, "docs/evidence/_shared/prod-roles-20261016.txt"), "utf8");
    // 角色行形态 = `角色码\t中文名\t["权限串"]`（同文件的 BUTTON/CATALOG/MENU 菜单计数行不带数组 ⇒ 被排除）
    const roleLines = prod.split(/\r?\n/).filter((l) => /^[A-Z_]+\t.*\t\[/.test(l));
    expect(roleLines.length).toBe(12);
    expect(roleLines.some((l) => l.startsWith("BOSS\t"))).toBe(false);
  });
});

describe("S3-237 组 1 · 零回归：`notification/send` 的页面使用者 ⊆ 码持有者", () => {
  it("唯一页面调用点 `InventoryPriceQuote.vue` 的 `meta.roles` = [SUPER_ADMIN] 单角色", () => {
    const router = readFileSync(path.join(REPO_ROOT, "admin-web/src/router/index.ts"), "utf8");
    const line = router.split(/\r?\n/).find((l) => l.includes("InventoryPriceQuote.vue"))!;
    expect(line).toContain('meta: { roles: ["SUPER_ADMIN"]');

    const page = readFileSync(path.join(REPO_ROOT, "admin-web/src/views/inventory/InventoryPriceQuote.vue"), "utf8");
    expect(page).toContain("sendNotification(");
    const api = readFileSync(path.join(REPO_ROOT, "admin-web/src/api/system.ts"), "utf8");
    expect(api).toContain('api.post("/admin/notifications/send"');
    // 该页角色仅超管 ⇒ 超管持 `*` ⇒ 通过（其余页面角色为空集，回归面为 0）
    expect(matchPermission(USERS[SUPER_ADMIN].perms, "system:notification:send")).toBe(true);
  });
});
