/**
 * TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · **储值卡冻结/解冻权限码收口（2 条）** 接线验收测试
 *
 * 派单卡：`ZXQL-WORK/projects/ms/tasks/inbox/ACTIVE-TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01.md`
 * 依据：凌舟裁定（卡面 §二，权限码固定 `finance:create`，不新增码、不改迁移、不改业务状态机）
 * 父卡：TOTAL-MEMBER-PERMISSION-CODES-01（其卡面明示「freeze/unfreeze 两行不在本卡裁定范围，
 *       仍登记在 rbac-wiring-baseline.json gaps」，本卡负责收口）
 *
 * 事实依据（卡面 §二）：
 *  - `backend/src/routes/store-value-card.routes.ts` freeze/unfreeze 两行原**仅认证无权限码**
 *    （仅认证 ≠ 授权：任何登录账号可冻结/解冻他人储值卡）；
 *  - 同文件开卡/充值/消费/退款四行均 `finance:create`（TOTAL-MEMBER-PERMISSION-CODES-01 已接）；
 *  - 同域先例 `bank-account.routes.ts` freeze/unfreeze 也用 `finance:create`（G1 已接 8 行中 2 行）。
 *
 * 本文件要证明的五件事：
 *  a) 2 条的**注册行级**形状：注册行直接带 `requirePermission("finance:create")`（踩坑[134]：注释不算，
 *     文件级子串不算——同文件 consume/refund 行早已有该子串）；
 *  b) **缺码 / 非持有人 ⇒ 403**，且**未到达业务层**（判据不是恒 true 的假门禁；非仅靠认证）；
 *  c) **持有人 ⇒ 200**：FINANCE_STAFF 经 `finance:*` 域通配命中（零回归）；
 *  d) **既有读取路径不受影响**：3 条 GET（无权限码）对任何登录账号（含只读观察员）仍 200；
 *  e) 不涉及新权限码/新迁移：`finance:create` 为 079 权限矩阵既有码。
 *
 * 判据来源：权限匹配语义用**生产同一份** `services/admin/rbac.service.ts` 的 `matchPermission`
 *   （`*` / `dom:*` / 精确码；`finance:*` 命中 `finance:*` 族码、不命中 `customer:*` 族码）。
 *
 * 反测（门禁铁律）：mutation ①漏码（freeze 摘码）②错码（unfreeze 挂错域码 customer:edit）
 *   ③只守一条（仅 freeze 挂、unfreeze 不挂）⇒ 对应用例必红；
 *   SHA256 复原 ⇒ 复绿（原始输出见 `projects/ms/evidence/TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01/raw/`）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
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

vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());

vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));

/**
 * 测试账号：权限串 = **生产只读实值**（与 total-member-permission-codes-wiring.test.ts 同一张表，
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
const FINANCE_STAFF = 9008;
/** 店长（生产在用角色，持 customer:* 但不持 finance:*）——零回归面：本卡不得让其 403 只出现在 GET 上 */
const STORE_MANAGER = 9003;

/** 本卡已接 **2 行**（凌舟裁定：权限码固定 `finance:create`） */
const ROWS: { file: string; routePath: string; path: string; controller: string; perm: string }[] = [
  { file: "store-value-card.routes.ts", routePath: "/:cardNo/freeze", path: "/VC1/freeze", controller: "freezeCard", perm: "finance:create" },
  { file: "store-value-card.routes.ts", routePath: "/:cardNo/unfreeze", path: "/VC1/unfreeze", controller: "unfreezeCard", perm: "finance:create" },
];

/** 既有读取路径（无权限码，认证即可）——本卡不得影响 */
const GET_ROWS: { label: string; path: string }[] = [
  { label: "GET /api/admin/store-value-cards（储值卡列表）", path: "/" },
  { label: "GET /api/admin/store-value-cards/VC1（储值卡详情）", path: "/VC1" },
  { label: "GET /api/admin/store-value-cards/VC1/transactions（流水）", path: "/VC1/transactions" },
];

const PREFIX = "/api/admin/store-value-cards";

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
  app.use(PREFIX, storeValueCardRouter);
  return app;
}

const APP = buildApp();

function call(method: "post" | "get", url: string, uid?: number) {
  const req = request(APP)[method](`${PREFIX}${url}`);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

/** 取某文件里「注册某方法＋某路径模式」的**行**（跳过注释行）——踩坑[134] */
function registrationLines(method: "post" | "get", routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, "store-value-card.routes.ts"), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
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

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · 名单自证", () => {
  it("2 行 = 卡面裁定逐行（freeze + unfreeze，均在 store-value-card.routes.ts）", () => {
    expect(ROWS).toHaveLength(2);
    expect(ROWS.map((r) => r.controller).sort()).toEqual(["freezeCard", "unfreezeCard"]);
  });

  it("权限码逐行 = 卡面裁定 finance:create（不新增权限码、不跨域）", () => {
    expect(new Set(ROWS.map((r) => r.perm))).toEqual(new Set(["finance:create"]));
  });

  it("e) finance:create 为既有码（同文件 consume/refund 行同码先例；不涉及新迁移）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "store-value-card.routes.ts"), "utf8");
    // 同文件 4 行既有先例（TOTAL-MEMBER-PERMISSION-CODES-01 已接）：
    expect(src).toContain('requirePermission("finance:create")');
    expect(src.match(/requirePermission\("finance:create"\)/g)?.length).toBe(6);
    // 不出现其它写码（跨域判定：不得改挂 customer:edit / customer:points 等）
    for (const wrong of ["customer:edit", "customer:points", "customer:create", "marketing:create"]) {
      expect(src, `不得出现 ${wrong}`).not.toContain(`requirePermission("${wrong}")`);
    }
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · a) 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines("post", row.routePath);
    expect(lines, `${row.routePath} 应恰有 1 条注册行`).toHaveLength(1);
    expect(lines[0].line, `store-value-card.routes.ts:${lines[0].no} 应带 requirePermission("${row.perm}")`).toContain(`requirePermission("${row.perm}")`);
  });

  it("同文件其它 4 条写端点（开卡/充值/消费/退款）保持原接线不动", () => {
    for (const routePath of ["/", "/:cardNo/recharge", "/:cardNo/consume", "/:cardNo/refund"]) {
      const lines = registrationLines("post", routePath);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(l.line, `${routePath} 既有接线不得被动`).toContain('requirePermission("finance:create")');
      }
    }
  });

  it("业务状态机不动：freeze/unfreeze 两行 handler 仍为 freezeCard/unfreezeCard", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "store-value-card.routes.ts"), "utf8");
    expect(src).toContain('svcController.freezeCard');
    expect(src).toContain('svcController.unfreezeCard');
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("finance:create 持有人 = SUPER_ADMIN / OPERATION_ADMIN / FINANCE_STAFF（finance:* 域通配）", () => {
    expect(holdersOf("finance:create")).toEqual([9002, FINANCE_STAFF, 9010]);
  });

  it("判据有分辨力：域通配不跨域；`:view` 不覆盖写动作（反证非恒 true 假门禁）", () => {
    expect(matchPermission(["customer:*"], "finance:create")).toBe(false);
    expect(matchPermission(["*:view"], "finance:create")).toBe(false);
    expect(matchPermission(["finance:payment"], "finance:create")).toBe(false);
    expect(matchPermission(["finance:daily-settle"], "finance:create")).toBe(false);
    expect(matchPermission(["finance:*"], "finance:create")).toBe(true);
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · b) 非持有人 ⇒ 403 且未到达业务层（非仅靠认证）", () => {
  it.each(ROWS)("$routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    h.reached.length = 0;
    const res = await call("post", row.path, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$routePath：全部非持有人（逐账号枚举，含店长/操作员/客服）⇒ 403 且未到达业务层", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call("post", row.path, uid);
      expect(res.status, `${USERS[uid].name} 不应通过 ${row.routePath}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${row.routePath} 的业务层`).toEqual([]);
    }
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · c) 持有人 ⇒ 200 且到达业务层", () => {
  it.each(ROWS)("$routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call("post", row.path, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${row.routePath}`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached, `${row.routePath} 应到达 ${row.controller}`).toContain(row.controller);
    }
  });

  it.each(ROWS)("$routePath：FINANCE_STAFF（finance:*）在用角色零回归", async (row) => {
    h.reached.length = 0;
    const res = await call("post", row.path, FINANCE_STAFF);
    expect(res.status, `在用角色 ${USERS[FINANCE_STAFF].name} 被 ${row.routePath} 打成 403 ⇒ 回归`).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · d) 既有读取路径不受影响（GET 类无权限码仍 200）", () => {
  it.each(GET_ROWS)("$label：READONLY（仅认证，无任何写码）⇒ 200", async (row) => {
    h.reached.length = 0;
    const res = await call("get", row.path, READONLY);
    expect(res.status, `${row.label} 读取路径不得被本卡误拦`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("店长（customer:*，不持 finance:create）：GET 仍 200、freeze/unfreeze 403（只读不受影响、写按码判定）", async () => {
    for (const row of GET_ROWS) {
      const res = await call("get", row.path, STORE_MANAGER);
      expect(res.status, `${row.label} 对店长应 200`).toBe(200);
    }
    for (const row of ROWS) {
      const res = await call("post", row.path, STORE_MANAGER);
      expect(res.status, `${row.routePath} 对店长应 403`).toBe(403);
    }
  });
});

describe("TOTAL-MEMBER-VALUE-CARD-LIFECYCLE-CODES-01 · 未登录 ⇒ 401（既有行为不变）", () => {
  it.each(ROWS)("$routePath：未登录 ⇒ 401", async (row) => {
    const res = await request(APP).post(`${PREFIX}${row.path}`).send({});
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });
});
