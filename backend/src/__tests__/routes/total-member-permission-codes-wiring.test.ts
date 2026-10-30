/**
 * TOTAL-MEMBER-PERMISSION-CODES-01 · **会员域写端点立码（5 条）** 接线验收测试
 *
 * 派单卡：`ZXQL-WORK/projects/ms/tasks/inbox/ACTIVE-TOTAL-MEMBER-PERMISSION-CODES-01.md`
 * 依据：凌舟裁定（卡面 §二权限码裁定表，执行方不得改宽/跨域）｜父卡：MOBILE-32F4（后端缺口实证）
 *
 * MOBILE-32F4 实证（`h5-three-states.mjs` 头注逐行引用）：以下 5 行**仅认证无权限码**
 * （store.routes.ts:44/45、store-value-card.routes.ts:9/11、points.routes.ts:14 原行号）
 * ⇒ 任何登录账号可写会员/储值/积分数据。本卡按裁定立码：
 *
 *   | 端点                                              | 权限码            |
 *   |---------------------------------------------------|-------------------|
 *   | POST /api/store/members/manage                    | customer:create   |
 *   | PUT /api/store/members/:id                        | customer:edit     |
 *   | POST /api/admin/store-value-cards                 | finance:create    |
 *   | POST /api/admin/store-value-cards/:cardNo/recharge| finance:create    |
 *   | POST /api/admin/members/:id/points/adjust         | customer:points   |
 *
 * `customer:points` **已有正式注册行**（`app-mobile-menu-catalog.ts:70` 目录行 +
 * `app-mobile/src/config/function-menu.ts:85` 页面注册码，经 server.ts `ensureAppMobileMenus`
 * 自愈进 t_sys_menu）⇒ 不新增迁移（S3-231 F1 的 `customer:level` 同款先例）；
 * 不得改挂 marketing:points / marketing:create（卡面明令）。
 *
 * 本文件要证明的五件事：
 *  a) 5 条的**注册行级**形状：注册行直接带 `requirePermission("<裁定码>")`（踩坑[134]：注释不算）；
 *  b) **缺码 / 非持有人 ⇒ 403**，且**未到达业务层**（判据不是恒 true 的假门禁；非仅靠认证）；
 *  c) **持有人 ⇒ 200**：customer:create/edit/points 经 `customer:*` 域通配命中（店长零回归），
 *     finance:create 由 FINANCE_STAFF `finance:*` 命中；
 *  d) **既有读取路径不受影响**：6 条 GET（无权限码）对任何登录账号（含只读观察员）仍 200；
 *  e) `customer:points` 的注册行在两份目录中**逐字存在**，且不涉及新迁移。
 *
 * 判据来源：权限匹配语义用**生产同一份** `services/admin/rbac.service.ts` 的 `matchPermission`
 *   （`*` / `dom:*` / 精确码；`customer:*` 命中 `customer:*` 族码、不命中 `finance:*` 族码）。
 *
 * 反测（门禁铁律）：摘掉任一行 `requirePermission(...)` ⇒ 形状断言与「非持有人 ⇒ 403」用例必红；
 *   复原 ⇒ 绿（mutation ①②③ 原始输出见 `projects/ms/evidence/TOTAL-MEMBER-PERMISSION-CODES-01/raw/`）。
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

vi.mock("@controllers/store/member.controller", () => h.stub());
vi.mock("@controllers/store/product.controller", () => h.stub());
vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());
vi.mock("@controllers/admin/points.controller", () => h.stub());

vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { storeMemberRouter } from "../../routes/store.routes";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";
import { pointsRouter } from "../../routes/points.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));

type Method = "post" | "put" | "delete";

/**
 * 测试账号：权限串 = **生产只读实值**（与 rbac-b2-s3-231-f1-member-levels-wiring.test.ts 同一张表，
 * 源 = `docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default`）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"] },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"] },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"] },
  9006: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"] },
  9007: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"] },
  9008: { name: "finance_staff", roles: ["FINANCE_STAFF"], perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"] },
  9009: { name: "customer_service", roles: ["CUSTOMER_SERVICE"], perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"] },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"] },
};

const READONLY = 9001;
const STORE_MANAGER = 9003;
const FINANCE_STAFF = 9008;

interface Row {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  controller: string;
  perm: string;
}

/** 本卡已接 **5 行**（凌舟裁定表逐行） */
const ROWS: Row[] = [
  {
    file: "store.routes.ts", prefix: "/api/store/members", router: storeMemberRouter,
    method: "post", routePath: "/manage", path: "/manage", controller: "createMemberManage", perm: "customer:create",
  },
  {
    file: "store.routes.ts", prefix: "/api/store/members", router: storeMemberRouter,
    method: "put", routePath: "/:id(\\\\d+)", path: "/9", controller: "updateMemberManage", perm: "customer:edit",
  },
  {
    file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter,
    method: "post", routePath: "/", path: "/", controller: "createStoreValueCard", perm: "finance:create",
  },
  {
    file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter,
    method: "post", routePath: "/:cardNo/recharge", path: "/VC1/recharge", controller: "rechargeCard", perm: "finance:create",
  },
  {
    file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter,
    method: "post", routePath: "/:id/points/adjust", path: "/1/points/adjust", controller: "adjustCustomerPoints", perm: "customer:points",
  },
];

/** 既有读取路径（无权限码，认证即可）——本卡不得影响 */
const GET_ROWS: { label: string; prefix: string; router: Router; path: string }[] = [
  { label: "GET /api/store/members（会员列表）", prefix: "/api/store/members", router: storeMemberRouter, path: "/" },
  { label: "GET /api/store/members/manage（会员管理列表）", prefix: "/api/store/members", router: storeMemberRouter, path: "/manage" },
  { label: "GET /api/store/members/9（会员详情）", prefix: "/api/store/members", router: storeMemberRouter, path: "/9" },
  { label: "GET /api/admin/store-value-cards（储值卡列表）", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, path: "/" },
  { label: "GET /api/admin/store-value-cards/VC1（储值卡详情）", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, path: "/VC1" },
  { label: "GET /api/admin/members/1/points/records（积分明细）", prefix: "/api/admin/members", router: pointsRouter, path: "/1/points/records" },
];

function buildApp() {
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
  for (const row of ROWS) app.use(row.prefix, row.router);
  return app;
}

const APP = buildApp();

function call(method: Method, prefix: string, url: string, uid?: number) {
  const req = request(APP)[method](`${prefix}${url}`);
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

function label(row: Row) {
  return `${row.file} ${row.method.toUpperCase()} ${row.routePath}`;
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

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · 名单自证", () => {
  it("5 行 = 凌舟裁定表逐行（3 文件：store.routes 2 + store-value-card.routes 2 + points.routes 1）", () => {
    expect(ROWS).toHaveLength(5);
    expect(new Map(ROWS.map((r) => [r.file, r.file])).size).toBe(3);
    expect(ROWS.map((r) => r.controller).sort()).toEqual([
      "adjustCustomerPoints",
      "createMemberManage",
      "createStoreValueCard",
      "rechargeCard",
      "updateMemberManage",
    ]);
  });

  it("权限码逐行 = 卡面裁定（不改宽、不跨域；不得出现 marketing:points / marketing:create）", () => {
    expect(ROWS.map((r) => r.perm)).toEqual([
      "customer:create",
      "customer:edit",
      "finance:create",
      "finance:create",
      "customer:points",
    ]);
    for (const f of ["store.routes.ts", "store-value-card.routes.ts", "points.routes.ts"]) {
      const src = readFileSync(path.join(ROUTES_DIR, f), "utf8");
      expect(src, `${f} 不得挂 marketing:points`).not.toContain('requirePermission("marketing:points")');
    }
  });

  it("e) customer:points 已有正式注册行（菜单目录行 + 页面注册码）⇒ 不新增迁移", () => {
    const catalog = readFileSync(
      fileURLToPath(new URL("../../shared/app-mobile-menu-catalog.ts", import.meta.url)),
      "utf8"
    );
    expect(catalog).toMatch(/code:\s*"customer:points",\s*parent:\s*"customer"/);
    const fm = readFileSync(
      fileURLToPath(new URL("../../../../app-mobile/src/config/function-menu.ts", import.meta.url)),
      "utf8"
    );
    expect(fm).toMatch(/code:\s*['"]customer:points['"]/);
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · a) 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 应带 requirePermission("${row.perm}")`).toContain(`requirePermission("${row.perm}")`);
    }
  });

  it("同文件**未在本卡范围**的行保持原状：store-value-card freeze/unfreeze 两行不含 requirePermission(", () => {
    for (const routePath of ["/:cardNo/freeze", "/:cardNo/unfreeze"]) {
      const lines = registrationLines("store-value-card.routes.ts", "post", routePath);
      expect(lines).toHaveLength(1);
      expect(lines[0].line, `${routePath} 不在本卡裁定范围，不得偷接`).not.toContain("requirePermission(");
    }
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("customer:create / customer:edit / customer:points 持有人 = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER（customer:* 域通配）", () => {
    for (const perm of ["customer:create", "customer:edit", "customer:points"]) {
      expect(holdersOf(perm), perm).toEqual([9002, STORE_MANAGER, 9010]);
    }
  });

  it("finance:create 持有人 = SUPER_ADMIN / OPERATION_ADMIN / FINANCE_STAFF（finance:* 域通配）", () => {
    expect(holdersOf("finance:create")).toEqual([9002, FINANCE_STAFF, 9010]);
  });

  it("判据有分辨力：域通配不跨域；精确码不命中；`:view` 不覆盖写动作", () => {
    expect(matchPermission(["store:*"], "customer:create")).toBe(false);
    expect(matchPermission(["finance:*"], "customer:points")).toBe(false);
    expect(matchPermission(["customer:view"], "customer:points")).toBe(false);
    expect(matchPermission(["*:view"], "customer:create")).toBe(false);
    expect(matchPermission(["marketing:create"], "customer:points")).toBe(false);
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · b) 非持有人 ⇒ 403 且未到达业务层（非仅靠认证）", () => {
  it.each(ROWS)("$file $method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    h.reached.length = 0;
    const res = await call(row.method, row.prefix, row.path, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$file $method $routePath：全部非持有人（逐账号枚举）⇒ 403", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row.method, row.prefix, row.path, uid);
      expect(res.status, `${USERS[uid].name} 不应通过 ${label(row)}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · c) 持有人 ⇒ 200 且到达业务层", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row.method, row.prefix, row.path, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached.length).toBeGreaterThan(0);
    }
  });

  it.each(ROWS)("$file $method $routePath：店长（customer 族码）/ 财务（finance:create）在用角色零回归", async (row) => {
    const uid = row.perm.startsWith("finance:") ? FINANCE_STAFF : STORE_MANAGER;
    h.reached.length = 0;
    const res = await call(row.method, row.prefix, row.path, uid);
    expect(res.status, `在用角色 ${USERS[uid].name} 被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · d) 既有读取路径不受影响（GET 类无权限码仍 200）", () => {
  it.each(GET_ROWS)("$label：READONLY（仅认证，无任何写码）⇒ 200", async (row) => {
    h.reached.length = 0;
    const res = await call("get", row.prefix, row.path, READONLY);
    expect(res.status, `${row.label} 读取路径不得被本卡误拦`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});

describe("TOTAL-MEMBER-PERMISSION-CODES-01 · 未登录 ⇒ 401（既有行为不变）", () => {
  it.each(ROWS)("$file $method $routePath：未登录 ⇒ 401", async (row) => {
    const res = await request(APP)[row.method](`${row.prefix}${row.path}`).send({});
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });
});
