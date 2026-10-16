/**
 * S3-231 · **F1 · 会员等级配置 4 条改挂 `customer:level`** 接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-231.md` §F1｜依据：凌舟裁定 1
 *   （`docs/tasks/cards/R101-S3-229-凌舟验收与裁定.md` §二.1：**改挂 `customer:level`**）
 * 授权模型：`docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md`（不变量 **I1'①**）
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md`（S3-229 §十七 → 本单 §十八）｜证据：`docs/evidence/S3-231/F1/`
 *
 * 本文件要证明的六件事（对应派单卡 §F1 证据行）：
 *  a) 4 条的**注册行级**形状：注册行直接带 `requirePermission("customer:level")`（踩坑[134]：注释不算）；
 *  b) **缺码 / 非持有人 ⇒ 403**，且**未到达业务层**（证明判据不是恒 true 的假门禁）；
 *  c) **店长（STORE_MANAGER）⇒ 200**：经 `customer:*` 域通配命中（I1'① 的"零回归"核心）；
 *  d) **三端一致**：同一条码在后台/移动端解析出的权限集合一致（`user-permissions.ts` 唯一出处）；
 *  e) **影响面逐条登记**：被降级（该页变只读）的角色集合与"因缺码被拦"的入口清单**必须非空且可复算**，
 *     不得静默 —— 本文件把影响面写成断言（SALES_STAFF / CUSTOMER_SERVICE 持 `customer:view` 精确码 ⇒ 不命中域通配）；
 *  f) 同文件**未接**的 `POST /:id/points/adjust`（B 类）注册行**不含** `requirePermission(`（没多接、没偷接）。
 *
 * 判据来源：权限匹配语义用**生产同一份** `services/admin/rbac.service.ts` 的 `matchPermission`
 *   （`*` / `dom:*` / `*:action` / 精确码；`customer:level` 的域 = `customer` ⇒ `customer:*` 命中、`customer:view` 不命中）。
 * 角色权限串 = 生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt`（租户 `default`）。
 *
 * 反测（门禁铁律）：摘掉**任一条**（本文件取中间那条 `PUT /levels/config/:id`）的 `requirePermission(...)`
 *   ⇒ 形状断言与「非持有人 ⇒ 403」用例必红；复原 ⇒ 绿（原始输出见 `docs/evidence/S3-231/F1/25-neg-*.txt`）。
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
import { pointsRouter } from "../../routes/points.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));

type Method = "post" | "put" | "delete";

/**
 * 测试账号：权限串 = **生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default`）。
 * `accounts` = 生产绑定账号数（`prod-role-usage-20261016.sql`）：只约束**在用**角色（不变量 I1'）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; accounts: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], accounts: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], accounts: 2 },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"], accounts: 1 },
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
const READONLY = 9001;
const SALES_STAFF = 9005;
const CUSTOMER_SERVICE = 9009;

const PERM = "customer:level";

interface Row {
  method: Method;
  routePath: string;
  path: string;
  controller: string;
}

/** 本单 F1 已接 **4 行**（`points.routes.ts`） */
const ROWS: Row[] = [
  { method: "post", routePath: "/levels/config", path: "/levels/config", controller: "createLevelConfig" },
  { method: "put", routePath: "/levels/config/:id", path: "/levels/config/1", controller: "updateLevelConfig" },
  { method: "put", routePath: "/levels/config/:id/status", path: "/levels/config/1/status", controller: "updateLevelConfigStatus" },
  { method: "delete", routePath: "/levels/config/:id", path: "/levels/config/1", controller: "deleteLevelConfig" },
];

const PREFIX = "/api/admin/members";

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

function call(method: Method, url: string, uid?: number) {
  const app = APP;
  const req = request(app)[method](url);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APP = buildApp(PREFIX, pointsRouter);

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

function label(row: { method: Method; routePath: string }) {
  return `points.routes.ts ${row.method.toUpperCase()} ${row.routePath}`;
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

describe("S3-231 F1 · 名单自证", () => {
  it("4 行（`points.routes.ts` 会员等级配置：增/改/启停/删）", () => {
    expect(ROWS).toHaveLength(4);
    expect(new Set(ROWS.map((r) => r.controller)).size).toBe(4);
  });

  it("只用 1 个**既有页面注册码** `customer:level`（本单不新立权限码、不改角色种子、不动迁移）", () => {
    expect(PERM).toBe("customer:level");
  });

  it("`customer:level` 是在用角色 STORE_MANAGER 的**页面注册码**，非跨域码（`marketing:create` 于本页无据）", () => {
    // 页面注册码出处：app-mobile/src/config/function-menu.ts:84
    // 相对本文件：`backend/src/__tests__/routes/` → 仓库根（上溯 4 级）→ app-mobile
    const fm = readFileSync(
      fileURLToPath(new URL("../../../../app-mobile/src/config/function-menu.ts", import.meta.url)),
      "utf8"
    );
    expect(fm).toMatch(/code:\s*['"]customer:level['"]/);
    expect(fm).not.toMatch(/code:\s*['"]marketing:level['"]/);
  });
});

describe("S3-231 F1 · 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$method $routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines("points.routes.ts", row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `points.routes.ts:${l.no} 应带 requirePermission("${PERM}")`).toContain(`requirePermission("${PERM}")`);
    }
  });

  it("同文件**未接**的 `POST /:id/points/adjust`（B 类）注册行**不含** requirePermission(", () => {
    const lines = registrationLines("points.routes.ts", "post", "/:id/points/adjust");
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `points.routes.ts:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
  });
});

describe("S3-231 F1 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("`customer:level` 持有人 = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER（店长经 `customer:*` 域通配命中）", () => {
    expect(holdersOf(PERM)).toEqual([SUPER_ADMIN, STORE_MANAGER, 9010].sort((a, b) => a - b));
  });

  it("命中机制自证：域通配 `customer:*` 命中；精确码 `customer:view` **不**命中；`*:view` 不覆盖写动作", () => {
    expect(matchPermission(USERS[STORE_MANAGER].perms, PERM)).toBe(true); // customer:*
    expect(matchPermission(["customer:*"], PERM)).toBe(true); // 域通配分支
    expect(matchPermission(USERS[SALES_STAFF].perms, PERM)).toBe(false); // customer:view（精确码，非通配）
    expect(matchPermission(USERS[CUSTOMER_SERVICE].perms, PERM)).toBe(false);
    expect(matchPermission(USERS[READONLY].perms, PERM)).toBe(false); // *:view
    expect(matchPermission(USERS[9004].perms, PERM)).toBe(false); // STORE_OPERATOR
    expect(matchPermission(USERS[9006].perms, PERM)).toBe(false); // PURCHASE_STAFF
    expect(matchPermission(USERS[9007].perms, PERM)).toBe(false); // WAREHOUSE_STAFF
  });

  it("判据有分辨力：域通配不跨域（`goods:*` 不命中 `customer:level`）", () => {
    expect(matchPermission(["goods:*"], PERM)).toBe(false);
    expect(matchPermission(["marketing:create"], PERM)).toBe(false);
  });
});

describe("S3-231 F1 · b) 缺码 / 非持有人 ⇒ 403 且未到达业务层", () => {
  it.each(ROWS)("$method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    h.reached.length = 0;
    const res = await call(row.method, `${PREFIX}${row.path}`, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${PERM}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$method $routePath：全部非持有人（逐账号枚举）⇒ 403", async (row) => {
    for (const uid of nonHoldersOf(PERM)) {
      h.reached.length = 0;
      const res = await call(row.method, `${PREFIX}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name} 不应通过 ${label(row)}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("S3-231 F1 · c) 有码 ⇒ 通过（店长零回归）", () => {
  it.each(ROWS)("$method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(PERM)) {
      h.reached.length = 0;
      const res = await call(row.method, `${PREFIX}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached.length).toBeGreaterThan(0);
    }
  });

  it.each(ROWS)("$method $routePath：**在用**店长（STORE_MANAGER，1 账号）⇒ 200", async (row) => {
    h.reached.length = 0;
    const res = await call(row.method, `${PREFIX}${row.path}`, STORE_MANAGER);
    expect(res.status, `在用店长被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("S3-231 F1 · 未登录 ⇒ 401（既有行为不变）", () => {
  it.each(ROWS)("$method $routePath：未登录 ⇒ 401", async (row) => {
    const res = await request(APP)[row.method](`${PREFIX}${row.path}`).send({});
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });
});

/**
 * e) **影响面逐条登记**（派单卡 §F3 同款要求；本单 F1 亦须给影响面）。
 * 影响面 = ① 在用角色里**不持有**该码、但对该页可见 ⇒ 页面写能力被**降级**（不是"入口消失"，F1 只动后端码）；
 *          ② 这些角色的**账号数**必须为 0 或属「只读观察员」，否则失败关闭会打断在用角色 ⇒ 必须显式断言。
 */
describe("S3-231 F1 · e) 影响面（被降级角色 / 被打 403 的角色，逐条可复算）", () => {
  it("被降级（该页变只读）的在用/未用角色清单 = {SALES_STAFF(0 账号), CUSTOMER_SERVICE(0 账号)}，均无非观察员在用角色被锁死", () => {
    const degraded = nonHoldersOf(PERM)
      .filter((uid) => {
        const u = USERS[uid];
        // 页面可见角色（function-menu.ts 的 customer:level）＝ 持 customer:* 或 customer:view 的角色
        return u.perms.includes("customer:*") || u.perms.includes("customer:view");
      })
      .map((uid) => ({ name: USERS[uid].name, role: USERS[uid].roles[0], accounts: USERS[uid].accounts, perms: USERS[uid].perms }));

    expect(degraded.map((d) => d.role)).toEqual(["SALES_STAFF", "CUSTOMER_SERVICE"]);
    // 关键断言：被降级的角色里**没有任何"在用写角色"**（不变量 I1' 的零回归底线）
    for (const d of degraded) {
      expect(d.accounts, `${d.name} 若为在用角色则本单接线即回归`).toBe(0);
    }
  });

  it("在用只读观察员 READONLY（1 账号）写得 403 属**改造前既有**期望（该角色本无写码）", async () => {
    for (const row of ROWS) {
      const res = await call(row.method, `${PREFIX}${row.path}`, READONLY);
      expect(res.status, `${label(row)} 对观察员应为 403（期望行为，非本单回归）`).toBe(403);
    }
  });

  it("在用写角色（SUPER_ADMIN / STORE_MANAGER）**无一**被本单锁死（逐条试跑）", async () => {
    for (const row of ROWS) {
      for (const uid of [SUPER_ADMIN, STORE_MANAGER]) {
        const res = await call(row.method, `${PREFIX}${row.path}`, uid);
        expect(res.status, `在用写角色 ${USERS[uid].name} 被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
      }
    }
  });
});
