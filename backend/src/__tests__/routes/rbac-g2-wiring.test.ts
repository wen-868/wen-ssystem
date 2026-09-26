/**
 * S3-125 · G2（灰度第三档）权限接线验收测试
 *
 * 派单卡：docs/tasks/cards/R101-派单-20260926-S3-125.md
 * 审计表：docs/tasks/cards/R101-S3-125-阿坚-Audit.md
 *
 * 本文件要证明的五件事（对应派单卡「验收标准（硬）」①③④⑤⑥）：
 *  a) 12 行候选 = 可接 1 行 + 待裁 11 行（等式自证）；
 *  b) 已接 1 行（`POST /api/admin/expenses` ⇒ `finance:create`）：READONLY ⇒ 403 且**未到达业务层**，
 *     许可角色（SUPER_ADMIN / OPERATION_ADMIN / FINANCE_STAFF）⇒ 200（到达业务层）；
 *  c) 待裁 11 行 ⇒ READONLY **仍然 200**（证明没偷偷接），且其注册行**行级**不含 `requirePermission(`；
 *  d) 形状断言：判据是**注册行级**（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  e) 待裁原因可复核（B 类「app-mobile 页面 → 菜单映射 / 可达链」证据锚点、C 类「G0 范围控制断言」锚点、
 *     R 类「共享 Router 第二挂载点」锚点）。
 *
 * 保真度说明（哪些是真的、哪些是桩）：
 *  · 真：路由文件（`backend/src/routes/**`）与其注册顺序、`requirePermission` 中间件本体、
 *        `matchPermission` 权限匹配器（含 `*` / `dom:*` / `*:action` 语义，S3-122-F1 产物）、
 *        CSRF 校验顺序（生产在挂载层、先于路由匹配 —— 见踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用生产角色实值权限串喂真实匹配器）、
 *        控制器（只记录「请求是否到达业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉 `expense.routes.ts` 的 `requirePermission("finance:create")`
 *   ⇒ 本文件「READONLY ⇒ 403」用例必红；复原后回绿、文件字节一致。
 *
 * 与 rbac-g0-wiring.test.ts / rbac-g1-wiring.test.ts 的关系：本文件只**新增**用例；
 *   G0 的逐行 403/200/401 断言与「范围控制」名单一字未改（G0 文件仅同步"全量接线总数"快照 40 → 41，
 *   见回传卡报备）；G1 文件仅把本单**已接线**的 `expense.routes.ts /` 一行移出 G1 待裁名单
 *   （G1 的 8 行已接断言、C 类 4 行锚点、A 类 8 行锚点一字未动）。
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
  /** 控制器桩：任意导出名 ⇒ 返回 200 的 handler（并记录到达） */
  const stub = () => {
    const cache = new Map<string, unknown>();
    return new Proxy(
      {},
      {
        get(_target, prop) {
          // 注意：模块命名空间会被运行期判 thenable，桩必须对 then/符号属性返回 undefined，
          // 否则会以 (resolve, reject) 调用被当成 handler，报 “res.json is not a function”。
          if (typeof prop === "symbol" || prop === "then" || prop === "catch" || prop === "finally") {
            return undefined;
          }
          const key = String(prop);
          if (!cache.has(key)) {
            cache.set(key, (req: any, res: any) => {
              reached.push(key);
              res.json({ success: true, code: "0", msg: "成功", handler: key });
            });
          }
          return cache.get(key);
        },
        // vitest 的 callFunctionMock 用 `prop in target` 判断导出是否存在，故必须声明 has
        has(_target, prop) {
          return typeof prop !== "symbol";
        },
      }
    );
  };
  return { reached, perms, stub };
});

// ---- 控制器全部打桩：本测试只关心「有没有被权限门禁拦住」 ----
vi.mock("@controllers/admin/expense.controller", () => h.stub());
vi.mock("@controllers/admin/bank-account.controller", () => h.stub());
vi.mock("@controllers/admin/receipt.controller", () => h.stub());
vi.mock("@controllers/admin/reconciliation.controller", () => h.stub());
vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());
vi.mock("@controllers/admin/payment-new.controller", () => h.stub());
vi.mock("@controllers/admin/sale-return.controller", () => h.stub());

// ---- 权限判定：数据库读取打桩（数据取生产角色实值），匹配逻辑用 F1 的真实 matchPermission ----
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { expenseRouter } from "../../routes/expense.routes";
import { bankAccountRouter } from "../../routes/bank-account.routes";
import { receiptRouter } from "../../routes/receipt.routes";
import { reconciliationRouter } from "../../routes/reconciliation.routes";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";
import { paymentNewRouter } from "../../routes/payment-new.routes";
import { saleReturnRouter, routeConfigs as saleReturnRouteConfigs } from "../../routes/sale-return.routes";

/**
 * 测试账号：权限串照抄 `rbac-g1-wiring.test.ts`（= 生产角色实值口径：
 * 派单卡 R3 + `docs/ops/S3-122-F3-role-permission-align.sql` / `S3-122-F4-finance-daily-settle.sql` 头注）。
 * 口径一致性很重要：本文件的"权限持有人集合"必须与 G1 复算结果同源，否则会像踩坑[143]那样出现"手写期望与数据不同源"。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "smoke_bot", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  /** 079 种子口径的门店店长（**无** finance:*、无 goods:price）——"种子口径"对照 */
  9004: {
    name: "store_manager_seed",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*"],
  },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
  },
  9007: {
    name: "purchase_staff",
    roles: ["PURCHASE_STAFF"],
    perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"],
  },
  /** F4 订正后的门店操作员：删 finance:payment、补 finance:daily-settle（精确保留 sale:create） */
  9008: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  /** F4 订正后的门店店长（生产实值）：含 finance:payment / goods:price / finance:daily-settle，无 finance:create */
  9009: {
    name: "store_manager_prod",
    roles: ["STORE_MANAGER"],
    perms: [
      "store:*",
      "sale:*",
      "customer:*",
      "inventory:*",
      "report:*",
      "dashboard:*",
      "finance:payment",
      "goods:price",
      "finance:daily-settle",
    ],
  },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"] },
  /** 客服（079:85-93 种子值，本单未复核生产实值）——R 行锁死面的依据：无 sale:create 但有 sale:bill 页 */
  9011: {
    name: "customer_service",
    roles: ["CUSTOMER_SERVICE"],
    perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"],
  },
};
const READONLY_USER = 9001;
const SUPER_ADMIN_USER = 9002;
const SALES_STAFF = 9003;
const FINANCE_STAFF = 9006;
const STORE_OPERATOR = 9008;
const STORE_MANAGER_PROD = 9009;
const OPERATION_ADMIN_USER = 9010;
const CUSTOMER_SERVICE = 9011;

type Method = "post" | "put" | "delete";

interface G2Row {
  /** 路由文件中**注册用的路径模式**（形状断言用；与测试 URL 不同） */
  routePath: string;
  /** 测试请求 URL（把 :param 换成具体值） */
  path: string;
  perm: string;
  /** 允许通过该权限点的账号（按生产角色实值推导） */
  allow: number[];
}

interface G2Module {
  file: string;
  prefix: string;
  router: Router;
  rows: G2Row[];
}

/**
 * G2 已接名单（**1 行**，逐行见审计表「判定 = 可接」）。
 * 判据（派单卡 §一）：`前端允许角色集合 ⊆ 权限持有人集合`。
 * 本行证据：app-mobile 费用新建页 `pages-sub/finance/finance/expense-create.vue:82`（`expenseApi.create`
 * → `app-mobile/src/api/modules/expenses.ts:90` `POST /admin/expenses`）；该页**零菜单映射**
 * （`finance:expenses` 不在 `t_sys_menu`，`docs/migrations/079_权限矩阵.sql:153-157` 财务子菜单仅
 * receipt/payment/statement/receivable/report），可达链 = 功能中心「费用支出」（`function-menu.ts:94`，
 * 模块前缀 `finance`，按 `function-menu.ts:175` `code.split(':')[0]` 过滤）→ `expenses.vue:168` → 新建页，
 * 即**仅** `finance` 模块持有者（FINANCE_STAFF；READONLY 全开但为只读角色，按派单卡 §一-4 不计入写入角色）。
 * admin-web 侧 `views/finance/ExpensesView.vue` 路由门禁 `[SUPER_ADMIN]`（G1 审计表第 13 行）。
 */
const WIRED_MODULES: G2Module[] = [
  {
    file: "expense.routes.ts",
    prefix: "/api/admin/expenses",
    router: expenseRouter,
    rows: [{ routePath: "/", path: "/", perm: "finance:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, FINANCE_STAFF] }],
  },
];

/**
 * G2 待裁名单（**11 行**，本单**不得接线**；每行给出待裁原因，逐行证据见审计表）。
 *  reason 口径（本单定义，与审计表 §〇 一致）：
 *   · B = app-mobile 页面→菜单映射（或可达链）判据不通过：页面可达角色集（写入角色）⊄ 权限持有人集合；
 *   · C = 与既有 `rbac-g0-wiring.test.ts`「范围控制」断言冲突（接线必须改该断言，本单未授权改这三行）；
 *   · R = 共享 Router 的第二挂载点副作用：接线会同时作用于 `/api/store/sale-returns`（本单范围外的行）。
 */
interface G2UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  routePath: string;
  path: string;
  reason: "B" | "C" | "R";
  note: string;
}

const UNWIRED: G2UnwiredRow[] = [
  // ---- B：页面可达角色集（写入角色）不 ⊆ finance:create 持有人集合 ----
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    routePath: "/",
    path: "/",
    reason: "B",
    note:
      "app-mobile 门店管理页 stores.vue:241（bankAccountsApi.create → stores.ts:141）；" +
      "页面菜单 store:list（function-menu.ts:117 / t_sys_menu 079:169）持有人 = 店长/操作员/仓管，" +
      "且 我的页 profile.vue:42 为**无条件**入口 ⇒ 写入角色 ⊄ finance:create（店长/操作员/仓管被锁死）",
  },
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    routePath: "/:id/close",
    path: "/1/close",
    reason: "B",
    note:
      "app-mobile 门店管理页 stores.vue:263（bankAccountsApi.close → stores.ts:146 注销银行卡）；" +
      "页面菜单 store:list（function-menu.ts:117 / t_sys_menu 079:169）持有人 = 店长/操作员/仓管，" +
      "且 我的页 profile.vue:42 为**无条件**入口 ⇒ 写入角色 ⊄ finance:create（店长/操作员/仓管被锁死）",
  },
  {
    file: "receipt.routes.ts",
    prefix: "/api/admin/receipts",
    router: receiptRouter,
    routePath: "/",
    path: "/",
    reason: "B",
    note:
      "app-mobile 开单页 create-sale.vue:2202（receiptApi.create → receipts.ts:54）；" +
      "页面菜单 sale:bill（function-menu.ts:38 / 079:129）持有人 = 店长/操作员/销售/客服，" +
      "且 首页快捷入口 home.vue:69 为**无条件**入口 ⇒ 写入角色 ⊄ finance:create",
  },
  {
    file: "reconciliation.routes.ts",
    prefix: "/api/admin/reconciliation",
    router: reconciliationRouter,
    routePath: "/customer/:customerId/confirm",
    path: "/customer/1/confirm",
    reason: "B",
    note:
      "app-mobile 对账页 reconciliation.vue:256（reconciliationApi.confirmCustomer → reconciliation.ts:69）；" +
      "该页**零菜单映射**（注册码 finance:reconciliation 无对应 t_sys_menu 行），" +
      "但 我的页 profile.vue:180 快捷入口为**无条件**（数组 profile.vue:177-181 无角色过滤）⇒ 全角色可达",
  },
  {
    file: "reconciliation.routes.ts",
    prefix: "/api/admin/reconciliation",
    router: reconciliationRouter,
    routePath: "/supplier/:supplierId/confirm",
    path: "/supplier/1/confirm",
    reason: "B",
    note:
      "app-mobile 对账页 reconciliation.vue:258（reconciliationApi.confirmSupplier → reconciliation.ts:98 供应商对账确认）；" +
      "该页**零菜单映射**（注册码 finance:reconciliation 无对应 t_sys_menu 行），" +
      "但 我的页 profile.vue:180 快捷入口为**无条件**（数组 profile.vue:177-181 无角色过滤）⇒ 全角色可达",
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    routePath: "/",
    path: "/",
    reason: "B",
    note:
      "app-mobile 会员详情页 member-detail.vue:536（无卡先开卡 POST /admin/store-value-cards）；" +
      "该页**零菜单映射**（member-detail 未在 function-menu.ts 注册），可达链 = 首页快捷入口" +
      "home.vue:87（会员管理，无条件）→ member-list.vue:192/193 → member-detail ⇒ 写入角色 ⊄ finance:create",
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    routePath: "/:cardNo/freeze",
    path: "/VC1/freeze",
    reason: "B",
    note:
      "app-mobile 储值卡页 stored-cards.vue:142（storedCardApi.lock → stored-cards.ts:85）；" +
      "注册码 customer:stored-card 无对应 t_sys_menu 行，可达链 = member-detail.vue:440 → stored-cards 页（同上入口）",
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    routePath: "/:cardNo/unfreeze",
    path: "/VC1/unfreeze",
    reason: "B",
    note:
      "app-mobile 储值卡页 stored-cards.vue:144（storedCardApi.unlock → stored-cards.ts:90 解冻）；" +
      "注册码 customer:stored-card 无对应 t_sys_menu 行，可达链 = 首页快捷入口 home.vue:87（会员管理，无条件）" +
      "→ member-list.vue:192/193 → member-detail.vue:440 → stored-cards 页（member-detail 未在 function-menu.ts 注册）",
  },
  // ---- C（并含 B）：落在 G0「范围控制」已断言 READONLY 仍 200 的名单内 ----
  {
    file: "payment-new.routes.ts",
    prefix: "/api/admin/payments-new",
    router: paymentNewRouter,
    routePath: "/",
    path: "/",
    reason: "C",
    note:
      "G0 NOT_IN_G0 断言 READONLY 仍 200（rbac-g0-wiring.test.ts:256 附近）；且 app-mobile" +
      " create-sale.vue:2218（paymentNewApi.create → finance.ts:128）为 sale:bill 页（无条件入口）写调用点 ⇒ B 亦不通过",
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    routePath: "/:cardNo/recharge",
    path: "/VC1/recharge",
    reason: "C",
    note:
      "G0 NOT_IN_G0 断言 READONLY 仍 200；且 app-mobile stored-cards.vue:115（stored-cards.ts:80）、" +
      "member-detail.vue:534 为写调用点（可达链见上）⇒ B 亦不通过",
  },
  // ---- R（并含 C）：共享 Router 第二挂载点 ----
  {
    file: "sale-return.routes.ts",
    prefix: "/api/admin/sale-returns",
    router: saleReturnRouter,
    routePath: "/",
    path: "/",
    reason: "R",
    note:
      "G0 NOT_IN_G0 断言 READONLY 仍 200（C）；且 app-mobile 唯一调用点 create-sale.vue:2241 实走" +
      " `POST /store/sale-returns`（returns.ts:51）——该行与 /api/admin/sale-returns 是**同一个 Router 的两个挂载点**" +
      "（sale-return.routes.ts:19-21 的 routeConfigs）⇒ 接线会让 /store 挂载点一并要求 sale:create，" +
      "锁死 CUSTOMER_SERVICE（客服持 sale:bill 页面但无 sale:create）的移动端退货流程",
  },
];

const WIRED_CASES = WIRED_MODULES.flatMap((m) =>
  m.rows.map((r) => ({ file: m.file, prefix: m.prefix, router: m.router, ...r, label: `${m.file} POST ${m.prefix}${r.path}` }))
);
const ALLOWED_PAIRS = WIRED_CASES.flatMap((row) => row.allow.map((uid) => ({ ...row, uid })));
const G2_WIRED_TOTAL = WIRED_CASES.length;
const G2_UNWIRED_TOTAL = UNWIRED.length;

/** 与生产挂载链等价（auth → tenant → csrf）的测试 App：req.user 由请求头注入 */
function buildApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
      // 与 middleware/auth.ts:106 requireAuth 的 401 口径一致
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    (req as any).user = { id: uid, username: u.name, realName: u.name, roles: [...u.roles] };
    (req as any).tenantId = "1";
    next();
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
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

function call(app: express.Express, method: Method, url: string, uid?: number) {
  const req = request(app)[method](url);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(key: string, prefix: string, router: Router) {
  if (!APPS.has(key)) APPS.set(key, buildApp(prefix, router));
  return APPS.get(key)!;
}

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));

/** 取某文件里"注册某方法 + 某路径模式"的**行**（跳过注释行）——踩坑[134]：判据必须落到注册行 */
function registrationLines(file: string, method: Method, routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

/** 权限持有人集合：用 F1 的真实 matchPermission 对生产角色实值逐账号复算 */
function holdersOf(perm: string): number[] {
  return Object.entries(USERS)
    .filter(([, u]) => matchPermission(u.perms, perm))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
  for (const m of WIRED_MODULES) appFor(m.file, m.prefix, m.router);
});

describe("S3-125（G2）· 名单自证（验收标准①）", () => {
  it("12 行 = 可接 1 行 + 待裁 11 行", () => {
    expect(G2_WIRED_TOTAL).toBe(1);
    expect(G2_UNWIRED_TOTAL).toBe(11);
    expect(G2_WIRED_TOTAL + G2_UNWIRED_TOTAL).toBe(12);
  });

  it("已接 1 行分布：expense.routes.ts × 1", () => {
    const perFile = new Map<string, number>();
    for (const row of WIRED_CASES) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([["expense.routes.ts", 1]]);
  });

  it("待裁原因分布：B 8 / C 2 / R 1（B 类原 9 行中 1 行=expense 已接；R 行同时属 C 类 G0 冲突）", () => {
    expect(UNWIRED.filter((r) => r.reason === "B")).toHaveLength(8);
    expect(UNWIRED.filter((r) => r.reason === "C")).toHaveLength(2);
    expect(UNWIRED.filter((r) => r.reason === "R")).toHaveLength(1);
  });
});

describe("S3-125（G2）· 形状断言（行级判据；验收标准③，踩坑[134]）", () => {
  it.each(WIRED_CASES)("$label：注册行自带 requirePermission(\"$perm\")（且该行不是注释）", (row) => {
    const lines = registrationLines(row.file, "post", row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).toContain(`requirePermission("${row.perm}")`);
  });

  it.each(UNWIRED)("$file POST $routePath（待裁 $reason）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, "post", row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });

  it("整文件子串不足以判定（踩坑[134]）：store-value-card.routes.ts 文件级含 finance:create，但本单三行没有", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "store-value-card.routes.ts"), "utf8");
    // 文件级子串判据会得到"存在"的错误结论（同一文件里 consume/refund 行确实接了 finance:create）
    expect(src).toContain('requirePermission("finance:create")');
    for (const routePath of ["/", "/:cardNo/recharge", "/:cardNo/freeze", "/:cardNo/unfreeze"]) {
      const lines = registrationLines("store-value-card.routes.ts", "post", routePath);
      expect(lines).toHaveLength(1);
      expect(lines[0].line, `${routePath} 的注册行不得被误判为已接线`).not.toContain("requirePermission(");
    }
  });
});

describe("S3-125（G2）· 权限持有人集合复算（F1 matchPermission + 生产角色实值）", () => {
  it("finance:create 持有人集合（逐账号复算，非人工誊写；每个 id 附命中依据）", () => {
    // 9002 SUPER_ADMIN `*`；9010 OPERATION_ADMIN `*`；9006 FINANCE_STAFF `finance:*`（域通配）
    expect(holdersOf("finance:create")).toEqual([9002, 9006, 9010]);
    // 反证：店长（种子/生产实值，均不含 finance:create）、操作员、销售、采购、仓管、只读均不持有
    for (const uid of [9001, 9003, 9004, 9007, 9008, 9009]) {
      expect(holdersOf("finance:create"), `uid=${uid}`).not.toContain(uid);
    }
  });

  it.each(WIRED_CASES)("$label：许可角色集合 ⊆ 权限持有人集合（判据通过）", (row) => {
    const holders = holdersOf(row.perm);
    for (const uid of row.allow) expect(holders, `${row.label} 允许 ${uid}`).toContain(uid);
  });

  it("sale:create 持有人集合与 G1 口径一致（本单未接线，仅作待裁行 R 的锁死面依据）", () => {
    // 9002/9010 `*`；9003 SALES_STAFF 精确码；9008 STORE_OPERATOR 精确码；9009 STORE_MANAGER `sale:*`；9004 种子店长 `sale:*`
    expect(holdersOf("sale:create")).toEqual([9002, 9003, 9004, 9008, 9009, 9010]);
    // 客服（079 种子 perms，见 USERS 表）不在持有人集合内 —— 这正是 R 行（sale-returns）不能接线的锁死面：
    // 客服持有页面菜单 sale:bill（能看到开单页「退货」子页），但 app-mobile 退货实际走 /store/sale-returns
    // （同一个 Router 的第二挂载点）⇒ 一旦接线，客服的移动端退货会在 /store 挂载点被 403。
    expect(holdersOf("sale:create")).not.toContain(CUSTOMER_SERVICE);
  });
});

describe("S3-125（G2）· a) 只读账号被拦（验收标准③/④）", () => {
  it.each(WIRED_CASES)("$label ⇒ 403 且未到达业务层", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), "post", `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });
});

describe("S3-125（G2）· b) 有权角色照常通过（不锁死）", () => {
  it.each(ALLOWED_PAIRS)("$label：$uid ⇒ 到达业务层（200）", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), "post", `${row.prefix}${row.path}`, row.uid);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.handler).toBe("string");
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("域通配（F1 产物）真实生效：FINANCE_STAFF 的 finance:* 通过已接行", async () => {
    const res = await call(appFor("expense.routes.ts", "/api/admin/expenses", expenseRouter), "post", "/api/admin/expenses/", FINANCE_STAFF);
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("createExpense");
  });

  it("店长 / 操作员 / 销售（均不持有 finance:create）⇒ 已接行 403（证明本单没把 finance:create 扩面）", async () => {
    for (const uid of [STORE_MANAGER_PROD, STORE_OPERATOR, SALES_STAFF]) {
      const res = await call(appFor("expense.routes.ts", "/api/admin/expenses", expenseRouter), "post", "/api/admin/expenses/", uid);
      expect(res.status, `uid=${uid}`).toBe(403);
      expect(res.body.msg).toBe("无权限执行此操作，需要权限: finance:create");
    }
  });
});

describe("S3-125（G2）· c) 未接的 11 行仍然不被拦（验收标准⑤，证明没偷偷接）", () => {
  it.each(UNWIRED)("$file POST $routePath（待裁 $reason）：READONLY 仍然 200", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), "post", `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status, `${row.file} ${row.routePath}（${row.note}）`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("验收标准⑤ 点名的三行（#1 bank-accounts / #2 close / #4 receipts）逐条取原始读数", async () => {
    const named = UNWIRED.filter(
      (r) =>
        (r.file === "bank-account.routes.ts" && r.routePath === "/") ||
        (r.file === "bank-account.routes.ts" && r.routePath === "/:id/close") ||
        (r.file === "receipt.routes.ts" && r.routePath === "/")
    );
    expect(named).toHaveLength(3);
    for (const row of named) {
      const res = await call(appFor(row.file, row.prefix, row.router), "post", `${row.prefix}${row.path}`, READONLY_USER);
      expect(res.status, `${row.file} ${row.routePath}`).toBe(200);
      expect(typeof res.body.handler, `${row.file} ${row.routePath} 到达业务层`).toBe("string");
    }
  });
});

describe("S3-125（G2）· d) 未登录 401（既有行为不变）", () => {
  it.each(WIRED_CASES)("$label：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router), "post", `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-125（G2）· 待裁原因可复核（B / C / R 三类证据锚点）", () => {
  it("B 类 8 行：note 均给出 app-mobile 调用点 + 页面→菜单映射（或零映射可达链）", () => {
    const b = UNWIRED.filter((r) => r.reason === "B");
    expect(b).toHaveLength(8);
    for (const row of b) {
      // 每行必须写明调用点（.vue:行）与可达性依据（菜单码或"无条件入口"）
      expect(row.note, `${row.file} ${row.routePath}`).toMatch(/\.vue:\d+/);
      expect(row.note, `${row.file} ${row.routePath}`).toMatch(/function-menu\.ts:\d+|t_sys_menu|零菜单映射|无条件/);
    }
  });

  it("B 类锁死面成立：页面可达的写入角色确实不持有 finance:create（抽 3 个代表角色反证）", () => {
    const holders = holdersOf("finance:create");
    // 店长（store:list 页写入角色）/ 操作员 / 仓管 均不在 finance:create 持有人集合内
    for (const uid of [9004, 9008, 9009]) expect(holders).not.toContain(uid);
  });

  it("C 类 2 行的端点落在 G0「范围控制」名单内（与 rbac-g0-wiring.test.ts 交叉印证；只读该文件字符串）", () => {
    const g0 = readFileSync(fileURLToPath(new URL("./rbac-g0-wiring.test.ts", import.meta.url)), "utf8");
    for (const anchor of ["/VC1/recharge", "payments-new"]) {
      expect(g0, `G0 范围控制名单应仍含 ${anchor}`).toContain(anchor);
    }
    // 本单未接该三行 ⇒ G0 的 NOT_IN_G0 断言（READONLY 仍 200）保持有效、一字未改
    expect(g0).toContain("NOT_IN_G0");
  });

  it("R 类 1 行：sale-return Router 确有第二个挂载点 /api/store/sale-returns（app-mobile 实际调用的是它）", () => {
    const prefixes = saleReturnRouteConfigs.map((c) => c.prefix).sort();
    expect(prefixes).toEqual(["/api/admin/sale-returns", "/api/store/sale-returns"]);
    // 该 Router 的 POST "/" 注册行是**共享**的（同一 handler），故接线无法只作用于 admin 挂载点
    const lines = registrationLines("sale-return.routes.ts", "post", "/");
    expect(lines).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });

  it("§三 授权未被使用：本单未把 payments-new / recharge / sale-returns 移出 G0 的 NOT_IN_G0（三行全判待裁）", () => {
    expect(UNWIRED.filter((r) => r.reason === "C" || r.reason === "R").map((r) => `${r.file} ${r.routePath}`).sort()).toEqual([
      "payment-new.routes.ts /",
      "sale-return.routes.ts /",
      "store-value-card.routes.ts /:cardNo/recharge",
    ]);
  });
});
