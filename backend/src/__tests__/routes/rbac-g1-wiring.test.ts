/**
 * S3-122-G1 · G1（高风险写第二档）权限接线验收测试
 *
 * 派单卡：docs/tasks/cards/R101-派单-20260926-S3-122-G1.md
 * 审计表：docs/tasks/cards/R101-S3-122-G1-阿坚-Audit.md
 *
 * 本文件要证明的四件事（对应派单卡「验收标准（硬）」③④⑤⑥）：
 *  a) 只读账号（READONLY = `["*:view"]`）调 **本单已接的 8 行** ⇒ 403，且**未到达业务层**；
 *  b) 持有该权限点的角色（SUPER_ADMIN `["*"]` / OPERATION_ADMIN `["*"]` / FINANCE_STAFF `["finance:*"]` /
 *     SALES_STAFF `["sale:create",…]` / STORE_OPERATOR（F4 后）/ STORE_MANAGER（生产实值））⇒ 200（到达业务层）；
 *  c) **本单未接的 21 行** ⇒ READONLY 仍然 200（证明"没偷偷接"），且其注册行**行级**不含 `requirePermission(`；
 *  d) 形状断言：判据是**注册行级**（踩坑[134]：注释里的 `requirePermission(` 不算调用），
 *     文件级子串不足以判定 —— 见 §「形状断言（行级判据）」第 3 条。
 *
 * 保真度说明（哪些是真的、哪些是桩）：
 *  · 真：路由文件（`backend/src/routes/**`）与其注册顺序、`requirePermission` 中间件本体、
 *        `matchPermission` 权限匹配器（含 `*` / `dom:*` / `*:action` 语义，S3-122-F1 产物）、
 *        CSRF 校验顺序（生产在挂载层、先于路由匹配 —— 见踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用生产角色实值权限串喂真实匹配器）、
 *        控制器（只记录「请求是否到达业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉任一条 G1 `requirePermission(...)` ⇒ 本文件对应「READONLY ⇒ 403」用例必红。
 *
 * 与 rbac-g0-wiring.test.ts 的关系：本文件只**新增**用例；G0 文件的逐行 403/200/401 断言与
 * F4 复算断言一字未改（G0 文件仅有一处"全量接线总数"快照期望值随本单 32 → 40 同步，见回传卡报备第 1 条）。
 * F1 更正（2026-09-26）：凌舟真跑 `npx vitest run` 判红（`holdersOf("sale:create")` 的期望漏记了自表 9004）→ 本单更正该期望值，其余一字未动。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
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
        has(_target, prop) {
          return typeof prop !== "symbol";
        },
      }
    );
  };
  return { reached, perms, stub };
});

// ---- 控制器全部打桩：本测试只关心「有没有被权限门禁拦住」 ----
vi.mock("@controllers/admin/bank-account.controller", () => h.stub());
vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-flash-sale.controller", () => h.stub());
vi.mock("@controllers/admin/commission.controller", () => h.stub());
vi.mock("@controllers/admin/credit.controller", () => h.stub());
vi.mock("@controllers/admin/credit-adjust.controller", () => h.stub());
vi.mock("@controllers/admin/expense.controller", () => h.stub());
vi.mock("@controllers/admin/payment-new.controller", () => h.stub());
vi.mock("@controllers/admin/receipt.controller", () => h.stub());
vi.mock("@controllers/admin/reconciliation.controller", () => h.stub());
vi.mock("@controllers/admin/sale-return.controller", () => h.stub());
vi.mock("@controllers/admin/price-level.controller", () => h.stub());
vi.mock("@controllers/admin/price-management.controller", () => h.stub());
vi.mock("@controllers/admin/batch-price.controller", () => h.stub());
vi.mock("@controllers/admin/price-review.controller", () => h.stub());
vi.mock("@controllers/admin/payment.controller", () => ({ createPaymentController: () => h.stub() }));

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
import { bankAccountRouter } from "../../routes/bank-account.routes";
import { paymentRouter } from "../../routes/payment.routes";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";
import { adminMarketingFlashSaleRouter } from "../../routes/admin-marketing-flash-sale.routes";
import { commissionRouter } from "../../routes/commission.routes";
import { creditRouter } from "../../routes/credit.routes";
import { expenseRouter } from "../../routes/expense.routes";
import { paymentNewRouter } from "../../routes/payment-new.routes";
import { receiptRouter } from "../../routes/receipt.routes";
import { reconciliationRouter } from "../../routes/reconciliation.routes";
import { saleReturnRouter } from "../../routes/sale-return.routes";
import { priceRouter } from "../../routes/price.routes";

/**
 * 测试账号：权限串取**生产角色实值**（口径 = 派单卡 R3 + `docs/ops/S3-122-F4-finance-daily-settle.sql` 头注）
 *  · FINANCE_STAFF `finance:*`（域通配）/ SALES_STAFF、STORE_OPERATOR 精确 `sale:create` /
 *    STORE_MANAGER 生产实值含 `sale:*` 与 `goods:price`、`finance:payment`、`finance:daily-settle`（但**无** `finance:create`）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "smoke_bot", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  /** 079 种子口径的门店店长（**无** finance:*、无 goods:price）——仅作"种子口径"对照，不参与本单 allow */
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
};
const READONLY_USER = 9001;
const SUPER_ADMIN_USER = 9002;
const OPERATION_ADMIN_USER = 9010;
const FINANCE_STAFF = 9006;
const SALES_STAFF = 9003;
const STORE_OPERATOR = 9008;
const STORE_MANAGER_PROD = 9009;

type Method = "post" | "put" | "delete";

interface G1Row {
  /** 路由文件中**注册用的路径模式**（形状断言用；与测试 URL 不同） */
  routePath: string;
  /** 测试请求 URL（把 :param 换成具体值） */
  path: string;
  perm: string;
  /** 允许通过该权限点的账号（按生产角色实值推导） */
  allow: number[];
}

interface G1Module {
  file: string;
  prefix: string;
  router: Router;
  /** true = 生产挂载链无 auth/csrf（`auth:"none"`，如 /api/pay），端点级自带 requireAuthWithTenant */
  rawMount?: boolean;
  rows: G1Row[];
}

/**
 * G1 已接名单（**8 行**，逐行见审计表「判定 = 可接」）。
 * 口径 = 派单卡「判定：前端允许的角色集合 ⊆ 权限持有人集合 ⇒ 可接」，
 * 「前端允许的角色集合」取 `admin-web/src/router/index.ts` 对应路由行的 `meta.roles`，
 * 且该行**不含** app-mobile / 其它无角色门禁的写调用点（否则判待裁，见 G1_UNWIRED）。
 */
const WIRED_MODULES: G1Module[] = [
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    rows: [
      // 域内页面 :202 bank-accounts [SUPER_ADMIN]；全仓零调用点
      { routePath: "/:id/freeze", path: "/1/freeze", perm: "finance:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, FINANCE_STAFF] },
      { routePath: "/:id/unfreeze", path: "/1/unfreeze", perm: "finance:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, FINANCE_STAFF] },
    ],
  },
  {
    file: "payment.routes.ts",
    prefix: "/api/pay",
    router: paymentRouter,
    rawMount: true,
    rows: [
      // 域内页面：无（/api/pay 独立挂载）；全仓零调用点
      { routePath: "/orders", path: "/orders", perm: "finance:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, FINANCE_STAFF] },
    ],
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    rows: [
      // 域内页面 :150 store-value-cards [SUPER_ADMIN]；唯一调用点 admin-web StoreValueCards.vue:332
      { routePath: "/:cardNo/consume", path: "/VC1/consume", perm: "finance:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, FINANCE_STAFF] },
    ],
  },
  {
    file: "admin-marketing-flash-sale.routes.ts",
    prefix: "/api/admin/marketing",
    router: adminMarketingFlashSaleRouter,
    rows: [
      // 域内页面 :227 marketing/flash-sale [SUPER_ADMIN]（activate/pause 另见 :219 MarketingView [SUPER_ADMIN]）
      { routePath: "/flash-sales", path: "/flash-sales", perm: "sale:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, SALES_STAFF, STORE_OPERATOR, STORE_MANAGER_PROD] },
      { routePath: "/flash-sales/:id/activate", path: "/flash-sales/1/activate", perm: "sale:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, SALES_STAFF, STORE_OPERATOR, STORE_MANAGER_PROD] },
      { routePath: "/flash-sales/:id/pause", path: "/flash-sales/1/pause", perm: "sale:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, SALES_STAFF, STORE_OPERATOR, STORE_MANAGER_PROD] },
      // 全仓零调用点（admin-web/src/api/marketing.ts 无 /grab；miniapp 侧是另一条路由 marketing-miniapp.routes.ts，本单不触碰）
      { routePath: "/flash-sales/:id/grab", path: "/flash-sales/1/grab", perm: "sale:create", allow: [SUPER_ADMIN_USER, OPERATION_ADMIN_USER, SALES_STAFF, STORE_OPERATOR, STORE_MANAGER_PROD] },
    ],
  },
];

/** G1 待裁名单（**21 行**，本单**不得接线**；每行给出待裁原因，逐行证据见审计表） */
interface G1UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  rawMount?: boolean;
  routePath: string;
  path: string;
  /** 待裁原因（审计表口径）：A=已证实的角色门禁冲突；B=app-mobile 无角色门禁调用点（不可判定）；C=与既有 G0 断言冲突 */
  reason: "A" | "B" | "C";
  note: string;
}

const UNWIRED: G1UnwiredRow[] = [
  // ---- A：已证实的角色门禁冲突（前端页面允许的角色不持有建议权限点）----
  { file: "commission.routes.ts", prefix: "/api/admin/commission", router: commissionRouter, routePath: "/rules", path: "/rules", reason: "A", note: "提成规则页 :111 [SUPER_ADMIN,STORE_MANAGER]，店长不持有 finance:create" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId", path: "/1", reason: "A", note: "信用管理页 :162 [SUPER_ADMIN,STORE_MANAGER]，店长不持有 finance:create（零调用点）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/occupy", path: "/1/occupy", reason: "A", note: "同上（零调用点）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/release", path: "/1/release", reason: "A", note: "同上（零调用点）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/freeze", path: "/1/freeze", reason: "A", note: "同上（调用点 CreditView.vue:297）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/unfreeze", path: "/1/unfreeze", reason: "A", note: "同上（调用点 CreditView.vue:309）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/evaluate", path: "/1/evaluate", reason: "A", note: "同上（零调用点）" },
  { file: "credit.routes.ts", prefix: "/api/admin/credits", router: creditRouter, routePath: "/:customerId/auto-init", path: "/1/auto-init", reason: "A", note: "同上（零调用点）" },

  // ---- B：app-mobile（商家端）无角色门禁的写调用点 ⇒ 判据不可判定 ----
  { file: "bank-account.routes.ts", prefix: "/api/admin/bank-accounts", router: bankAccountRouter, routePath: "/", path: "/", reason: "B", note: "app-mobile 门店管理页 stores.vue:241（bankAccountsApi.create）" },
  { file: "bank-account.routes.ts", prefix: "/api/admin/bank-accounts", router: bankAccountRouter, routePath: "/:id/close", path: "/1/close", reason: "B", note: "app-mobile 门店管理页 stores.vue:263（bankAccountsApi.close）" },
  { file: "expense.routes.ts", prefix: "/api/admin/expenses", router: expenseRouter, routePath: "/", path: "/", reason: "B", note: "app-mobile 费用新建页 expense-create.vue:82（expenseApi.create）" },
  { file: "receipt.routes.ts", prefix: "/api/admin/receipts", router: receiptRouter, routePath: "/", path: "/", reason: "B", note: "app-mobile 开单页 create-sale.vue:2202（receiptApi.create）" },
  { file: "reconciliation.routes.ts", prefix: "/api/admin/reconciliation", router: reconciliationRouter, routePath: "/customer/:customerId/confirm", path: "/customer/1/confirm", reason: "B", note: "app-mobile 财务对账页 reconciliation.vue:256" },
  { file: "reconciliation.routes.ts", prefix: "/api/admin/reconciliation", router: reconciliationRouter, routePath: "/supplier/:supplierId/confirm", path: "/supplier/1/confirm", reason: "B", note: "app-mobile 财务对账页 reconciliation.vue:258" },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, routePath: "/", path: "/", reason: "B", note: "app-mobile 会员详情页 member-detail.vue:536（无卡先开卡）" },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, routePath: "/:cardNo/freeze", path: "/VC1/freeze", reason: "B", note: "app-mobile 储值卡页 stored-cards.vue:142（storedCardApi.lock）" },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, routePath: "/:cardNo/unfreeze", path: "/VC1/unfreeze", reason: "B", note: "app-mobile 储值卡页 stored-cards.vue:144（storedCardApi.unlock）" },

  // ---- C：与既有 G0 断言冲突（G0 已断言这些端点 READONLY 仍 200，本单不得放宽该断言，故不可接）----
  { file: "payment-new.routes.ts", prefix: "/api/admin/payments-new", router: paymentNewRouter, routePath: "/", path: "/", reason: "C", note: "G0 范围控制断言要求 READONLY 仍 200；且 app-mobile create-sale.vue:2218 有写调用点" },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, routePath: "/:cardNo/recharge", path: "/VC1/recharge", reason: "C", note: "G0 范围控制断言要求 READONLY 仍 200；且 app-mobile stored-cards.vue:115 / member-detail.vue:534 有写调用点" },
  { file: "sale-return.routes.ts", prefix: "/api/admin/sale-returns", router: saleReturnRouter, routePath: "/", path: "/", reason: "C", note: "G0 范围控制断言要求 READONLY 仍 200；且 app-mobile create-sale.vue:2241 有写调用点" },
  { file: "price.routes.ts", prefix: "/api/admin/prices", router: priceRouter, routePath: "/best-price", path: "/best-price", reason: "C", note: "G0 已把 best-price 列为「查询型 POST（待裁定）」并断言 READONLY 仍 200" },
];

const WIRED_CASES = WIRED_MODULES.flatMap((m) =>
  m.rows.map((r) => ({
    file: m.file,
    prefix: m.prefix,
    router: m.router,
    rawMount: m.rawMount,
    ...r,
    label: `${m.file} POST ${m.prefix}${r.path}`,
  }))
);
const ALLOWED_PAIRS = WIRED_CASES.flatMap((row) => row.allow.map((uid) => ({ ...row, uid })));
const G1_WIRED_TOTAL = WIRED_CASES.length;
const G1_UNWIRED_TOTAL = UNWIRED.length;

/** 与生产挂载链等价（auth → tenant → csrf）的测试 App：req.user 由请求头注入 */
function buildApp(prefix: string, router: Router, rawMount?: boolean) {
  const app = express();
  app.use(express.json());
  // `auth: "none"` 的路由（如 /api/pay）：生产不加 auth/csrf，登录态由端点级 requireAuthWithTenant 判定
  if (rawMount) {
    app.use(prefix, router);
    return app;
  }
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
  // 与 auto-routes.getAuthMiddlewares 一致：csrf 在挂载层执行、先于路由匹配（踩坑[34]）
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["GET", "OPTIONS", "HEAD"].includes(req.method)) return next();
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

/** 与生产同源的租户 JWT（rawMount 的端点由真实 requireAuth 校验签名/签发者/受众） */
function tenantToken(uid: number) {
  const u = USERS[uid];
  return jwt.sign(
    { id: uid, username: u.name, realName: u.name, roles: [...u.roles], tenantId: "1" },
    process.env.JWT_SECRET as string,
    { algorithm: "HS256", issuer: "zhixiang-system", audience: "zhixiang-client", expiresIn: "1h" }
  );
}

function call(app: express.Express, method: Method, url: string, uid?: number, rawMount?: boolean) {
  const req = request(app)[method](url);
  if (uid) {
    if (rawMount) req.set("Authorization", `Bearer ${tenantToken(uid)}`);
    else req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  }
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(key: string, prefix: string, router: Router, rawMount?: boolean) {
  if (!APPS.has(key)) APPS.set(key, buildApp(prefix, router, rawMount));
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
  for (const m of WIRED_MODULES) appFor(m.file, m.prefix, m.router, m.rawMount);
});

describe("S3-122-G1 · 名单自证（验收标准①）", () => {
  it("29 行 = 可接 8 行 + 待裁 21 行", () => {
    expect(G1_WIRED_TOTAL).toBe(8);
    expect(G1_UNWIRED_TOTAL).toBe(21);
    expect(G1_WIRED_TOTAL + G1_UNWIRED_TOTAL).toBe(29);
  });

  it("已接 8 行分布：bank-account 2 / payment 1 / store-value-card 1 / flash-sale 4", () => {
    const perFile = new Map<string, number>();
    for (const row of WIRED_CASES) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["admin-marketing-flash-sale.routes.ts", 4],
      ["bank-account.routes.ts", 2],
      ["payment.routes.ts", 1],
      ["store-value-card.routes.ts", 1],
    ]);
  });
});

describe("S3-122-G1 · 形状断言（行级判据；验收标准③，踩坑[134]）", () => {
  it.each(WIRED_CASES)("$label：注册行自带 requirePermission(\"$perm\")（且该行不是注释）", (row) => {
    const lines = registrationLines(row.file, "post", row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).toContain(`requirePermission("${row.perm}")`);
  });

  it.each(UNWIRED)("$file POST $routePath（待裁，原因 $reason）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, "post", row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });

  it("整文件子串不足以判定（踩坑[134]）：store-value-card.routes.ts 文件级含 finance:create，但 recharge/freeze/unfreeze 三行没有", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "store-value-card.routes.ts"), "utf8");
    // 文件级子串判据会得到"存在"的错误结论（同一文件里 refund 行确实接了 finance:create）
    expect(src).toContain('requirePermission("finance:create")');
    for (const routePath of ["/:cardNo/recharge", "/:cardNo/freeze", "/:cardNo/unfreeze"]) {
      const lines = registrationLines("store-value-card.routes.ts", "post", routePath);
      expect(lines).toHaveLength(1);
      expect(lines[0].line, `${routePath} 的注册行不得被误判为已接线`).not.toContain("requirePermission(");
    }
    // 而本单真正接线的 consume 行必须在注册行上带中间件
    const consume = registrationLines("store-value-card.routes.ts", "post", "/:cardNo/consume");
    expect(consume[0].line).toContain('requirePermission("finance:create")');
  });
});

describe("S3-122-G1 · 权限持有人集合复算（F1 matchPermission + 生产角色实值）", () => {
  it("三个建议权限点的持有人集合（逐账号复算，非人工誊写）", () => {
    // finance:create：SUPER_ADMIN(*)、OPERATION_ADMIN(*)、FINANCE_STAFF(finance:*)；店长/操作员/销售/采购/仓管/只读均不持有
    expect(holdersOf("finance:create")).toEqual([9002, 9006, 9010]);
    // sale:create：SUPER_ADMIN/OPERATION_ADMIN(*)、SALES_STAFF、STORE_OPERATOR（精确）、STORE_MANAGER(sale:*)
    // 9004 = 种子口径店长，因 sale:* 命中 sale:create，故属持有人（本测试遍历 USERS 全表复算）
    expect(holdersOf("sale:create")).toEqual([9002, 9003, 9004, 9008, 9009, 9010]);
    // goods:price：SUPER_ADMIN/OPERATION_ADMIN(*)、STORE_MANAGER（生产实值精确持有）
    expect(holdersOf("goods:price")).toEqual([9002, 9009, 9010]);
  });

  it("只读账号 READONLY（*:view）对三个权限点全部不持有（反证 G1 不是「永远 true」的假门禁）", () => {
    for (const perm of ["finance:create", "sale:create", "goods:price"]) {
      expect(matchPermission(USERS[READONLY_USER].perms, perm), perm).toBe(false);
    }
  });

  it.each(WIRED_CASES)("$label：许可角色集合 ⊆ 权限持有人集合（判据通过）", (row) => {
    const holders = holdersOf(row.perm);
    for (const uid of row.allow) expect(holders, `${row.label} 允许 ${uid}`).toContain(uid);
  });
});

describe("S3-122-G1 · a) 只读账号被拦（验收标准③/④）", () => {
  it.each(WIRED_CASES)("$label ⇒ 403 且未到达业务层", async (row) => {
    const res = await call(
      appFor(row.file, row.prefix, row.router, row.rawMount),
      "post",
      `${row.prefix}${row.path}`,
      READONLY_USER,
      row.rawMount
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });
});

describe("S3-122-G1 · b) 有权角色照常通过（不锁死）", () => {
  it.each(ALLOWED_PAIRS)("$label：$uid ⇒ 到达业务层（200）", async (row) => {
    const res = await call(
      appFor(row.file, row.prefix, row.router, row.rawMount),
      "post",
      `${row.prefix}${row.path}`,
      row.uid,
      row.rawMount
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.handler).toBe("string");
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("域通配（F1 产物）真实生效：FINANCE_STAFF 的 finance:* 通过 bank-account 两条 finance:create 行", async () => {
    for (const path of ["/1/freeze", "/1/unfreeze"]) {
      const res = await call(appFor("bank-account.routes.ts", "/api/admin/bank-accounts", bankAccountRouter), "post", `/api/admin/bank-accounts${path}`, FINANCE_STAFF);
      expect(res.status, path).toBe(200);
    }
  });

  it("精确码真实生效：STORE_OPERATOR（F4 后）的 sale:create 通过 flash-sale 四行；STORE_MANAGER 的 sale:* 同样通过", async () => {
    for (const path of ["/flash-sales", "/flash-sales/1/activate", "/flash-sales/1/pause", "/flash-sales/1/grab"]) {
      for (const uid of [STORE_OPERATOR, STORE_MANAGER_PROD]) {
        const res = await call(appFor("admin-marketing-flash-sale.routes.ts", "/api/admin/marketing", adminMarketingFlashSaleRouter), "post", `/api/admin/marketing${path}`, uid);
        expect(res.status, `${path} uid=${uid}`).toBe(200);
      }
    }
  });

  it("STORE_MANAGER（生产实值）**不**持有 finance:create ⇒ G1 的 finance:create 行对其 403（证明本单没把 finance:create 扩面到店长）", async () => {
    const res = await call(appFor("bank-account.routes.ts", "/api/admin/bank-accounts", bankAccountRouter), "post", "/api/admin/bank-accounts/1/freeze", STORE_MANAGER_PROD);
    expect(res.status).toBe(403);
    expect(res.body.msg).toBe("无权限执行此操作，需要权限: finance:create");

    const consume = await call(appFor("store-value-card.routes.ts", "/api/admin/store-value-cards", storeValueCardRouter), "post", "/api/admin/store-value-cards/VC1/consume", STORE_MANAGER_PROD);
    expect(consume.status).toBe(403);
  });
});

describe("S3-122-G1 · c) 未接的 21 行仍然不被拦（验收标准⑤，证明没偷偷接）", () => {
  it.each(UNWIRED)("$file POST $routePath（待裁 $reason）：READONLY 仍然 200", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), "post", `${row.prefix}${row.path}`, READONLY_USER, row.rawMount);
    expect(res.status, `${row.file} ${row.routePath}（${row.note}）`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("G0 已断言 READONLY 仍 200 的四行（本单 C 类待裁）逐条复核", async () => {
    const c = UNWIRED.filter((r) => r.reason === "C");
    expect(c.map((r) => `${r.file} ${r.routePath}`).sort()).toEqual([
      "payment-new.routes.ts /",
      "price.routes.ts /best-price",
      "sale-return.routes.ts /",
      "store-value-card.routes.ts /:cardNo/recharge",
    ]);
    for (const row of c) {
      const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), "post", `${row.prefix}${row.path}`, READONLY_USER, row.rawMount);
      expect(res.status, `${row.file} ${row.routePath}`).toBe(200);
    }
  });
});

describe("S3-122-G1 · d) 未登录 401（既有行为不变）", () => {
  it.each(WIRED_CASES)("$label：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), "post", `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-122-G1 · 待裁原因可复核（A/B/C 三类证据锚点）", () => {
  it("A 类 8 行：前端页面允许的角色（STORE_MANAGER）确实不在权限持有人集合里", () => {
    expect(holdersOf("finance:create")).not.toContain(STORE_MANAGER_PROD);
    expect(UNWIRED.filter((r) => r.reason === "A").map((r) => `${r.file} ${r.routePath}`)).toEqual([
      "commission.routes.ts /rules",
      "credit.routes.ts /:customerId",
      "credit.routes.ts /:customerId/occupy",
      "credit.routes.ts /:customerId/release",
      "credit.routes.ts /:customerId/freeze",
      "credit.routes.ts /:customerId/unfreeze",
      "credit.routes.ts /:customerId/evaluate",
      "credit.routes.ts /:customerId/auto-init",
    ]);
  });

  it("B 类 9 行：均为 app-mobile（无 meta.roles 门禁）的写调用点，判据不可判定", () => {
    const b = UNWIRED.filter((r) => r.reason === "B");
    expect(b).toHaveLength(9);
    for (const row of b) expect(row.note).toMatch(/app-mobile/);
  });

  it("C 类 4 行：均落在 G0「范围控制」已断言 READONLY 仍 200 的名单内，本单不得放宽该断言", () => {
    expect(UNWIRED.filter((r) => r.reason === "C")).toHaveLength(4);
    // 与 rbac-g0-wiring.test.ts 的 NOT_IN_G0 名单交叉印证（只读取该文件的字符串，不改其断言）
    const g0 = readFileSync(fileURLToPath(new URL("./rbac-g0-wiring.test.ts", import.meta.url)), "utf8");
    for (const anchor of ["/best-price", "/VC1/recharge", "path: \"/\"", "sale-returns"]) {
      expect(g0).toContain(anchor);
    }
  });
});
