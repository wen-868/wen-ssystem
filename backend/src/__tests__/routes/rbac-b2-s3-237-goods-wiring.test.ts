/**
 * S3-237 · 接线批 10 · **组 2「商品 A 类」7 条接线 + 8 条「不接」判定** 验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-237.md` §一 组 2｜码：`docs/migrations/079_权限矩阵.sql:200-201`
 * （既有码 `goods:create` / `goods:edit`）｜授权模型：不变量 **I1'** + 裁定 **D1**（店长补 goods 写码，不含 delete）+ **D4**
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §十二.4（A 类 15 条）→ §二十（本单处置）｜证据：`docs/evidence/S3-237/`
 *
 * ⚠️ **卡面数字差异（实名报备）**：派单卡 §一 组 2 表头写"**15 条 = 8（本批接）+ 3（DELETE 不接）+ 4（审核不接）+ 1（import 不接）**"，
 *   但 8 + 3 + 4 + 1 = 16 ≠ 15，且按机读台账 `rbac-wiring-baseline.json` 逐条清点是
 *   **barcode 1 + brands 3 + product-tags 3 + unit-groups 3 + reviews 4 + import 1 = 15**（与台账 §12.4 十五条一致）
 *   ⇒ 本批**可接的只有 7 条**（barcode 1 + POST/PUT 各 3 对 = 6）。本文件按**实测 7 条**交付，不擅自造第 8 条端点。
 *
 * 本文件要证明的六件事：
 *  a) **7 条**注册行自带 `requirePermission("goods:create"|"goods:edit")`（注册行级判据，踩坑[134]）；
 *  b) **缺码 / 非持有人 ⇒ 403** 且**未到达业务层**；
 *  c) **在用店长（STORE_MANAGER，1 账号）⇒ 200**：经 **D1**（迁移 204 补 `goods:create|edit`，生产已复核）持有 ⇒ **零回归**；
 *      并给出"**若没做 D1**"的反事实读数（旧权限串 ⇒ 403），证明本条零回归**依赖并锁定了 204**；
 *  d) **3 条 DELETE 确实没接**：注册行不含 `requirePermission(`，且店长**不持** `goods:delete`（⇒ 接了必 403，
 *      正是 D4「前端补门」的理由）；相邻的 POST/PUT **已接**（同文件对照，证明不是"整文件漏接"）；
 *  e) **4 条审核端点确实没接**：079 按钮码全表与迁移 204 的 14 个新码**均无审核类码**（静态复核，防"自造码"）；
 *  f) **8 条不接项的页面角色面**：DELETE 三行所在页面 `meta.roles` 含 STORE_MANAGER（⇒ 必须前端补门），
 *      而本批 7 行所在页面角色 ⊆ 码持有者（⇒ 可直接接）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { fail } from "../../shared/response";

const h = vi.hoisted(() => {
  const reached: string[] = [];
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

vi.mock("@controllers/admin/product.controller", () => h.stub());
vi.mock("@controllers/admin/brand.controller", () => h.stub());
vi.mock("@controllers/admin/product-marketing-tag.controller", () => h.stub());
vi.mock("@controllers/admin/unit-group.controller", () => h.stub());
vi.mock("@controllers/admin/product-image.controller", () => h.stub());
vi.mock("@controllers/admin/stock-warning.controller", () => h.stub());
vi.mock("@controllers/admin/category.controller", () => h.stub());

vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { adminProductRouter } from "../../routes/admin-product.routes";
import { brandRouter } from "../../routes/brand.routes";
import { productMarketingTagRouter } from "../../routes/product-marketing-tag.routes";
import { unitGroupRouter } from "../../routes/unit-group.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

type Method = "post" | "put" | "delete";

/** 权限串 = 生产只读实值 + 204 批注（`docs/evidence/_shared/prod-roles-20261016.txt` 顶部凌舟批注） */
const STORE_MANAGER_PERMS_POST_204 = [
  "store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*",
  "finance:payment", "goods:price", "finance:daily-settle", "goods:create", "goods:edit",
];
/** D1/204 之前的店长权限串（**反事实**用；仅用于证明"零回归依赖 204"，不作判据） */
const STORE_MANAGER_PERMS_PRE_204 = [
  "store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*",
  "finance:payment", "goods:price", "finance:daily-settle",
];

const USERS: Record<number, { name: string; roles: string[]; perms: string[]; accounts: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], accounts: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], accounts: 2 },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: STORE_MANAGER_PERMS_POST_204, accounts: 1 },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"], accounts: 1 },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"], accounts: 0 },
  9006: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"], accounts: 0 },
  9007: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"], accounts: 0 },
  9008: { name: "salesman_legacy", roles: ["SALESMAN"], perms: ["product:read", "order:read", "order:write", "customer:read", "customer:write"], accounts: 0 },
  9009: { name: "store_admin_legacy", roles: ["STORE_ADMIN"], perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"], accounts: 0 },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], accounts: 0 },
};

const SUPER_ADMIN = 9002;
const STORE_MANAGER = 9003;
const READONLY = 9001;
const OPERATION_ADMIN = 9010;
const SALESMAN_LEGACY = 9008;
const STORE_ADMIN_LEGACY = 9009;

const GOODS_CREATE = "goods:create";
const GOODS_EDIT = "goods:edit";
const GOODS_DELETE = "goods:delete";

const PRODUCTS = "/api/admin";
const BRANDS = "/api/admin/brands";
const TAGS = "/api/admin/product-tags";
const UNIT_GROUPS = "/api/admin/unit-groups";

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

/** 本批组 2 已接 **7 行**（barcode 1 + brands 2 + product-tags 2 + unit-groups 2） */
const ROWS: Row[] = [
  { file: "admin-product.routes.ts", prefix: PRODUCTS, router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId/barcode", path: "/products/skus/1/barcode", controller: "updateSkuBarcode", perm: GOODS_EDIT },
  { file: "brand.routes.ts", prefix: BRANDS, router: brandRouter, method: "post", routePath: "/", path: "/", controller: "createBrand", perm: GOODS_CREATE },
  { file: "brand.routes.ts", prefix: BRANDS, router: brandRouter, method: "put", routePath: "/:id", path: "/1", controller: "updateBrand", perm: GOODS_EDIT },
  { file: "product-marketing-tag.routes.ts", prefix: TAGS, router: productMarketingTagRouter, method: "post", routePath: "/", path: "/", controller: "createTag", perm: GOODS_CREATE },
  { file: "product-marketing-tag.routes.ts", prefix: TAGS, router: productMarketingTagRouter, method: "put", routePath: "/:id", path: "/1", controller: "updateTag", perm: GOODS_EDIT },
  { file: "unit-group.routes.ts", prefix: UNIT_GROUPS, router: unitGroupRouter, method: "post", routePath: "/", path: "/", controller: "createUnitGroup", perm: GOODS_CREATE },
  { file: "unit-group.routes.ts", prefix: UNIT_GROUPS, router: unitGroupRouter, method: "put", routePath: "/:id", path: "/1", controller: "updateUnitGroup", perm: GOODS_EDIT },
];

/** 本批**不接**的 DELETE 3 行（D1 不含 `goods:delete` ⇒ 按 D4 由前端补门） */
const NOT_WIRED_DELETE: { file: string; prefix: string; router: Router; routePath: string; path: string; page: string }[] = [
  { file: "brand.routes.ts", prefix: BRANDS, router: brandRouter, routePath: "/:id", path: "/1", page: "Brands.vue" },
  { file: "product-marketing-tag.routes.ts", prefix: TAGS, router: productMarketingTagRouter, routePath: "/:id", path: "/1", page: "ProductTags.vue" },
  { file: "unit-group.routes.ts", prefix: UNIT_GROUPS, router: unitGroupRouter, routePath: "/:id", path: "/1", page: "Units.vue" },
];

/** 本批**不接**的审核 4 行（079 / 204 均无审核类码 ⇒ 入下一批立码） */
const NOT_WIRED_REVIEW: { method: Method; routePath: string; path: string }[] = [
  { method: "post", routePath: "/:id/approve", path: "/1/approve" },
  { method: "post", routePath: "/:id/reject", path: "/1/reject" },
  { method: "post", routePath: "/batch-approve", path: "/batch-approve" },
  { method: "post", routePath: "/batch-reject", path: "/batch-reject" },
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
  if (!APPS.has(prefix)) APPS.set(prefix, buildApp(prefix, router));
  return APPS.get(prefix)!;
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

function label(row: { file: string; method: Method; routePath: string; perm: string }) {
  return `${row.file} ${row.method.toUpperCase()} ${row.routePath} ⇒ ${row.perm}`;
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

describe("S3-237 组 2 · 名单自证", () => {
  it("7 行（barcode 1 + brands 2 + product-tags 2 + unit-groups 2），只用 2 个**既有**码", () => {
    expect(ROWS).toHaveLength(7);
    expect(new Set(ROWS.map((r) => r.perm))).toEqual(new Set([GOODS_CREATE, GOODS_EDIT]));
    expect(ROWS.filter((r) => r.perm === GOODS_CREATE)).toHaveLength(3);
    expect(ROWS.filter((r) => r.perm === GOODS_EDIT)).toHaveLength(4);
  });

  it("卡面 15 条 = 7 接 + 3 DELETE + 4 审核 + 1 import（卡面「8」与 15 的构成自相矛盾 ⇒ 实名报备，不造第 8 条）", () => {
    // 台账 §12.4 十五条的构成（本批按实测消费）
    expect(ROWS.length + NOT_WIRED_DELETE.length + NOT_WIRED_REVIEW.length + 1).toBe(15);
  });

  it("两个码都是 079 既有码（不新立权限点、不改角色种子、不动迁移）", () => {
    const migration = readFileSync(path.join(REPO_ROOT, "docs/migrations/079_权限矩阵.sql"), "utf8");
    expect(migration).toContain("'goods:create', '新增商品'");
    expect(migration).toContain("'goods:edit',   '编辑商品'");
  });
});

describe("S3-237 组 2 · a) 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 应带 requirePermission("${row.perm}")`).toContain(`requirePermission("${row.perm}")`);
    }
  });
});

describe("S3-237 组 2 · b) 缺码 / 非持有人 ⇒ 403 且未到达业务层", () => {
  it.each(ROWS)("$file $method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    h.reached.length = 0;
    const res = await call(row, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$file $method $routePath：全部非持有人（逐账号枚举）⇒ 403", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）不应通过 ${label(row)}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("S3-237 组 2 · c) 有码 ⇒ 200（在用店长零回归，且该零回归**锁定 204**）", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人 ⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(row, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${label(row)}`).toBe(200);
      expect(res.body.handler).toBe(row.controller);
      expect(h.reached.length).toBeGreaterThan(0);
    }
  });

  it.each(ROWS)("$file $method $routePath：**在用**店长（STORE_MANAGER，1 账号）⇒ 200", async (row) => {
    h.reached.length = 0;
    const res = await call(row, STORE_MANAGER);
    expect(res.status, `在用店长被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("持有人集合复算：goods:create / goods:edit = {SUPER_ADMIN, OPERATION_ADMIN, STORE_MANAGER}（店长经 D1 精确码）", () => {
    const expectHolders = [SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN].sort((a, b) => a - b);
    expect(holdersOf(GOODS_CREATE)).toEqual(expectHolders);
    expect(holdersOf(GOODS_EDIT)).toEqual(expectHolders);
  });

  it("反事实：D1/204 **之前**的店长权限串不持这两个码 ⇒ 若没有 204，本批 7 行全都会 403（零回归依赖 204 已落地）", () => {
    for (const perm of [GOODS_CREATE, GOODS_EDIT]) {
      expect(matchPermission(STORE_MANAGER_PERMS_POST_204, perm)).toBe(true);
      expect(matchPermission(STORE_MANAGER_PERMS_PRE_204, perm)).toBe(false);
    }
  });

  it("旧词表角色（SALESMAN / STORE_ADMIN，0 账号）在新码体系下等同无写权限：`product:read`/`order:write` 不命中 goods 码", () => {
    for (const uid of [SALESMAN_LEGACY, STORE_ADMIN_LEGACY]) {
      expect(matchPermission(USERS[uid].perms, GOODS_CREATE)).toBe(false);
      expect(matchPermission(USERS[uid].perms, GOODS_EDIT)).toBe(false);
    }
  });
});

describe("S3-237 组 2 · d) 3 条 DELETE 确实没接（D4 前端补门的理由可复算）", () => {
  it.each(NOT_WIRED_DELETE)("$file DELETE $routePath：注册行**不含** requirePermission(（没多接）", (row) => {
    const lines = registrationLines(row.file, "delete", row.routePath);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
  });

  it.each(NOT_WIRED_DELETE)("$file DELETE $routePath：READONLY 仍到达业务层（未接线态显式锁定）", async (row) => {
    h.reached.length = 0;
    const res = await call({ ...row, method: "delete" as Method }, READONLY);
    expect(res.status).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("店主在用账号**不持** `goods:delete` ⇒ 若接 DELETE 即 403 回归（这就是本批不接的直接理由）", () => {
    expect(matchPermission(USERS[STORE_MANAGER].perms, GOODS_DELETE)).toBe(false);
    expect(USERS[STORE_MANAGER].accounts).toBeGreaterThan(0);
  });

  it("同文件对照：3 个文件的 POST/PUT 已接、DELETE 未接（不是「整文件漏接」）", () => {
    for (const file of ["brand.routes.ts", "product-marketing-tag.routes.ts", "unit-group.routes.ts"]) {
      const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
      expect(src, `${file} 应含 requirePermission(`).toContain("requirePermission(");
    }
  });
});

describe("S3-237 组 2 · e) 4 条审核端点确实没接（079 / 204 均无审核类码）", () => {
  it.each(NOT_WIRED_REVIEW)("$method $routePath：注册行**不含** requirePermission(（没自造码）", (row) => {
    const lines = registrationLines("product-review.routes.ts", row.method, row.routePath);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `product-review.routes.ts:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
  });

  it("无审核类码的静态复核：079 按钮码全表 + 迁移 204 的 14 个新码里**没有**审核语义码", () => {
    for (const file of ["079_权限矩阵.sql", "204_系统设置域权限点立码.sql"]) {
      const src = readFileSync(path.join(REPO_ROOT, "docs/migrations", file), "utf8");
      expect(src, `${file} 不应含审核类权限码`).not.toMatch(/'[a-z-]+:[a-z-]*:?review/);
      expect(src, `${file} 不应含 approve 类权限码`).not.toMatch(/'[a-z-]+:[a-z-]*:approve/);
    }
  });

  it("同文件已接的 `POST /`（提交审核 ⇒ goods:create）保持接线（本批不动别人已接的行）", () => {
    const lines = registrationLines("product-review.routes.ts", "post", "/");
    expect(lines.some((l) => l.line.includes('requirePermission("goods:create")'))).toBe(true);
  });
});

describe("S3-237 组 2 · f) 页面角色面（本批 7 行 ⊆ 码持有者；不接的 3 行页面含店长）", () => {
  const routerSrc = () => readFileSync(path.join(REPO_ROOT, "admin-web/src/router/index.ts"), "utf8");
  function pageLine(needle: string) {
    return routerSrc().split(/\r?\n/).find((l) => l.includes(needle))!;
  }

  it("商品管理页（`Products.vue`，barcode 调用点所在页）`meta.roles` = [SUPER_ADMIN, STORE_MANAGER] ⊆ 码持有者", () => {
    const line = pageLine("product/Products.vue");
    expect(line).toContain('roles: ["SUPER_ADMIN", "STORE_MANAGER"]');
  });

  it("品牌 / 单位 / 商品标签 / 营销标签 四页 `meta.roles` 均含 STORE_MANAGER（店长经 D1 持码 ⇒ 无回归）", () => {
    for (const needle of ["Brands.vue", "Units.vue", "ProductTags.vue", "MarketingTags.vue"]) {
      const line = pageLine(needle);
      expect(line, `${needle} 页面应含 STORE_MANAGER`).toContain("STORE_MANAGER");
      expect(USERS[STORE_MANAGER].roles).toContain("STORE_MANAGER");
    }
  });

  it("不接的 DELETE 三行所在页面确实是店长可见页（⇒ 必须先由前端补门，D4）", () => {
    for (const row of NOT_WIRED_DELETE) {
      expect(pageLine(row.page)).toContain("STORE_MANAGER");
    }
  });
});

/** import 行（不接）：全仓无真实调用点，该页实际打 data-transfer 导入（已由 S3-198 接 `store:transfer`） */
describe("S3-237 组 2 · g) `POST /products/import` 不接（无真实调用点）", () => {
  it("注册行不含 requirePermission(，且 READONLY 仍到达业务层", async () => {
    const lines = registrationLines("admin-product.routes.ts", "post", "/products/import");
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `admin-product.routes.ts:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
    h.reached.length = 0;
    const res = await call({ prefix: PRODUCTS, router: adminProductRouter, method: "post", path: "/products/import" }, READONLY);
    expect(res.status).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("前端导入页真实打的是 data-transfer 路径（`store:transfer` 已接，S3-198）；`importProducts` 封装无任何页面调用点", () => {
    const page = readFileSync(path.join(REPO_ROOT, "admin-web/src/views/product/ProductImport.vue"), "utf8");
    expect(page).toContain("/admin/data-transfer/import/products");

    // 递归扫 admin-web/src/views：`importProducts(` 的调用点必须为 0（封装在 api/product.ts:49，无人使用）
    const viewsDir = path.join(REPO_ROOT, "admin-web/src/views");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".vue") && /importProducts\(/.test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk(viewsDir);
    expect(hits, `以下页面调用了 importProducts（说明存在真实调用点，口径需重判）：${hits.join(", ")}`).toEqual([]);
  });
});
