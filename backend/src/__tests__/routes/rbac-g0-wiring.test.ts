/**
 * S3-122-F2 · G0（高风险写）权限接线验收测试
 *
 * 本测试要证明的三件事（对应派单卡「验收标准（硬）」②④⑤）：
 *  a) 只读账号（READONLY = `["*:view"]`）调 G0 写端点 ⇒ 403，且**未到达业务层**；
 *  b) 有权角色（SUPER_ADMIN `["*"]`、SALES_STAFF `["sale:create"]`、STORE_MANAGER `["inventory:*"]` …）
 *     ⇒ 通过权限判定并**到达业务层**；
 *  c) 未登录 ⇒ 401（既有行为不变）。
 *
 * 保真度说明（哪些是真的、哪些是桩）：
 *  · 真：路由文件（`backend/src/routes/**`）与其注册顺序、`requirePermission` 中间件本体、
 *        `matchPermission` 权限匹配器（含 `*` / `dom:*` / `*:action` 语义，S3-122-F1 产物）、
 *        CSRF 校验顺序（生产在挂载层、先于路由匹配 —— 见踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用 §2.2 的 079 种子权限串喂真实匹配器）、
 *        控制器（只记录「请求是否到达业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉任一条 `requirePermission(...)` ⇒ 本文件对应「READONLY ⇒ 403」用例必红。
 * S3-122-F4 追加：日结端点改挂 `finance:daily-settle` 后，本文件补「角色 × 5 端点复算表」——
 *   STORE_OPERATOR（F4 订正后）只过 #1 日结，#2–#5 四个收款类端点必须 403（反测：把 #1 改回
 *   `finance:payment` ⇒ STORE_OPERATOR 行必红）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync, readdirSync } from "node:fs";
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
vi.mock("@controllers/admin/price-level.controller", () => h.stub());
vi.mock("@controllers/admin/price-management.controller", () => h.stub());
vi.mock("@controllers/admin/batch-price.controller", () => h.stub());
vi.mock("@controllers/admin/price-review.controller", () => h.stub());
vi.mock("@controllers/store/inventory.controller", () => h.stub());
vi.mock("@controllers/admin/inventory-loss-order.controller", () => h.stub());
vi.mock("@controllers/admin/inventory-profit-order.controller", () => h.stub());
vi.mock("@controllers/admin/profit-loss-stats.controller", () => h.stub());
vi.mock("@controllers/admin/commerce-fix.controller", () => h.stub());
vi.mock("@controllers/store/sale-bill.controller", () => h.stub());
vi.mock("@controllers/admin/sale-return.controller", () => h.stub());
vi.mock("@controllers/admin/purchase.controller", () => h.stub());
vi.mock("@controllers/admin/daily-settlement.controller", () => h.stub());
vi.mock("@controllers/admin/finance-dashboard.controller", () => h.stub());
vi.mock("@controllers/admin/commission.controller", () => h.stub());
vi.mock("@controllers/admin/payment-new.controller", () => h.stub());
vi.mock("@controllers/admin/receipt.controller", () => h.stub());
vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());
vi.mock("@controllers/store/other.controller", () => h.stub());
vi.mock("@controllers/store/receivable.controller", () => h.stub());
vi.mock("@controllers/admin/credit.controller", () => h.stub());
vi.mock("@controllers/admin/credit-adjust.controller", () => h.stub());
vi.mock("@controllers/admin/payment.controller", () => ({ createPaymentController: () => h.stub() }));

// ---- 权限判定：数据库读取打桩（数据取 079 种子口径），匹配逻辑用 F1 的真实 matchPermission ----
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { priceRouter } from "../../routes/price.routes";
import { storeInventoryRouter } from "../../routes/store-inventory.routes";
import { inventoryProfitLossRouter } from "../../routes/inventory-profit-loss.routes";
import { adminCommerceFixRouter } from "../../routes/commerce-fix.routes";
import { storeSaleBillRouter } from "../../routes/store-sale-bill.routes";
import { saleReturnRouter } from "../../routes/sale-return.routes";
import { purchaseRouter } from "../../routes/purchase.routes";
import { adminFinanceRouter } from "../../routes/admin-finance.routes";
import { commissionRouter } from "../../routes/commission.routes";
import { paymentNewRouter } from "../../routes/payment-new.routes";
import { receiptRouter } from "../../routes/receipt.routes";
import { storeReceivableRouter } from "../../routes/store-receivable.routes";
import { paymentRouter } from "../../routes/payment.routes";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";
import { creditRouter } from "../../routes/credit.routes";

/** 测试账号：角色权限串照抄 `docs/migrations/079_权限矩阵.sql:85-93`（与凌舟本轮实测一致） */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "smoke_bot", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  9004: {
    name: "store_manager",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*"],
  },
  9005: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"] },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
  },
  9007: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"] },
  /** S3-122-F4 角色数据订正后的两个角色（口径 = 派单卡 R3：操作员删 finance:payment、补 finance:daily-settle） */
  9008: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  9009: {
    name: "store_manager_f4",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"],
  },
};
const READONLY_USER = 9001;
const SUPER_ADMIN_USER = 9002;

type Method = "post" | "put" | "delete";
interface G0Row {
  method: Method;
  path: string;
  perm: string;
  /** 允许通过该权限点的账号（按 079 权限串推导） */
  allow: number[];
}
interface G0Module {
  file: string;
  prefix: string;
  router: Router;
  /** true = 生产挂载链无 auth/csrf（`auth:"none"`，如 /api/pay），端点级自带 requireAuthWithTenant */
  rawMount?: boolean;
  rows: G0Row[];
}

/** G0 名单（32 条，见回传卡「交付物①」；行 = 路由注册点，perm = 挂的权限点） */
const MODULES: G0Module[] = [
  {
    file: "price.routes.ts",
    prefix: "/api/admin/prices",
    router: priceRouter,
    rows: [
      { method: "post", path: "/levels", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "put", path: "/levels/1", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "delete", path: "/levels/1", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "post", path: "/skus/1/prices", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "put", path: "/prices/1", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "delete", path: "/prices/1", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "post", path: "/customer-bindings", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "put", path: "/customer-bindings/1/approve", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "put", path: "/customer-bindings/1/reject", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "delete", path: "/customer-bindings/1", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "post", path: "/batch/execute", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
      { method: "post", path: "/review", perm: "goods:price", allow: [SUPER_ADMIN_USER] },
    ],
  },
  {
    file: "store-inventory.routes.ts",
    prefix: "/api/store/inventory",
    router: storeInventoryRouter,
    rows: [{ method: "post", path: "/adjust", perm: "inventory:adjust", allow: [SUPER_ADMIN_USER, 9004, 9005] }],
  },
  {
    file: "inventory-profit-loss.routes.ts",
    prefix: "/api/admin/inventory",
    router: inventoryProfitLossRouter,
    rows: [
      { method: "post", path: "/loss-orders", perm: "inventory:create", allow: [SUPER_ADMIN_USER, 9004, 9005] },
      { method: "post", path: "/loss-orders/1/approve", perm: "inventory:approve", allow: [SUPER_ADMIN_USER, 9004, 9005] },
      { method: "post", path: "/loss-orders/1/reject", perm: "inventory:approve", allow: [SUPER_ADMIN_USER, 9004, 9005] },
      { method: "post", path: "/profit-orders", perm: "inventory:create", allow: [SUPER_ADMIN_USER, 9004, 9005] },
      { method: "post", path: "/profit-orders/1/approve", perm: "inventory:approve", allow: [SUPER_ADMIN_USER, 9004, 9005] },
      { method: "post", path: "/profit-orders/1/reject", perm: "inventory:approve", allow: [SUPER_ADMIN_USER, 9004, 9005] },
    ],
  },
  {
    file: "commerce-fix.routes.ts",
    prefix: "/api/admin",
    router: adminCommerceFixRouter,
    rows: [
      { method: "post", path: "/bills", perm: "sale:create", allow: [SUPER_ADMIN_USER, 9003, 9004] },
      { method: "post", path: "/bills/1/verify", perm: "sale:create", allow: [SUPER_ADMIN_USER, 9003, 9004] },
    ],
  },
  {
    file: "store-sale-bill.routes.ts",
    prefix: "/api/store/sale-bills",
    router: storeSaleBillRouter,
    rows: [{ method: "post", path: "/", perm: "sale:create", allow: [SUPER_ADMIN_USER, 9003, 9004] }],
  },
  {
    file: "sale-return.routes.ts",
    prefix: "/api/admin/sale-returns",
    router: saleReturnRouter,
    rows: [{ method: "post", path: "/SR202601/refund", perm: "sale:return", allow: [SUPER_ADMIN_USER, 9004] }],
  },
  {
    file: "purchase.routes.ts",
    prefix: "/api/admin/purchase-orders",
    router: purchaseRouter,
    rows: [
      { method: "post", path: "/PO202601/submit", perm: "purchase:create", allow: [SUPER_ADMIN_USER, 9007] },
      { method: "post", path: "/PO202601/in-stock", perm: "purchase:create", allow: [SUPER_ADMIN_USER, 9007] },
    ],
  },
  {
    file: "admin-finance.routes.ts",
    prefix: "/api/admin",
    router: adminFinanceRouter,
    rows: [{ method: "post", path: "/daily-settlements", perm: "finance:daily-settle", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "commission.routes.ts",
    prefix: "/api/admin/commission",
    router: commissionRouter,
    rows: [{ method: "post", path: "/settle", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "payment-new.routes.ts",
    prefix: "/api/admin/payments-new",
    router: paymentNewRouter,
    rows: [{ method: "post", path: "/PAY202601/writeoff", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "receipt.routes.ts",
    prefix: "/api/admin/receipts",
    router: receiptRouter,
    rows: [{ method: "post", path: "/RC202601/writeoff", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "store-receivable.routes.ts",
    prefix: "/api/store/receivables",
    router: storeReceivableRouter,
    rows: [{ method: "post", path: "/AR202601/payment", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "payment.routes.ts",
    prefix: "/api/pay",
    router: paymentRouter,
    rawMount: true,
    rows: [{ method: "post", path: "/refunds", perm: "finance:create", allow: [SUPER_ADMIN_USER, 9006] }],
  },
  {
    file: "store-value-card.routes.ts",
    prefix: "/api/admin/store-value-cards",
    router: storeValueCardRouter,
    rows: [{ method: "post", path: "/VC202601/refund", perm: "finance:create", allow: [SUPER_ADMIN_USER, 9006] }],
  },
];

const G0_TOTAL = MODULES.reduce((sum, m) => sum + m.rows.length, 0);
const ALLOWED_PAIRS = MODULES.flatMap((m) =>
  m.rows.flatMap((r) =>
    r.allow.map((uid) => ({
      file: m.file,
      prefix: m.prefix,
      router: m.router,
      rawMount: m.rawMount,
      ...r,
      uid,
      label: `${m.file} ${r.method.toUpperCase()} ${m.prefix}${r.path}`,
    }))
  )
);
const G0_CASES = MODULES.flatMap((m) =>
  m.rows.map((r) => ({
    file: m.file,
    prefix: m.prefix,
    router: m.router,
    rawMount: m.rawMount,
    ...r,
    label: `${m.file} ${r.method.toUpperCase()} ${m.prefix}${r.path}`,
  }))
);

/**
 * S3-122-F4 · 本次拆分涉及的 5 条端点（**从 G0 名单派生**，避免两处口径漂移）：
 * #1 日结（新码 finance:daily-settle）+ #2 提成结算 / #3 支付核销 / #4 收据核销 / #5 应收收款（仍为 finance:payment）。
 */
const F4_FILES = [
  "admin-finance.routes.ts",
  "commission.routes.ts",
  "payment-new.routes.ts",
  "receipt.routes.ts",
  "store-receivable.routes.ts",
];
const F4_ROWS = MODULES.filter((m) => F4_FILES.includes(m.file)).flatMap((m) =>
  m.rows.map((r) => ({
    file: m.file,
    prefix: m.prefix,
    router: m.router,
    rawMount: m.rawMount,
    perm: r.perm,
    method: r.method,
    path: r.path,
    label: `${m.file} ${r.method.toUpperCase()} ${m.prefix}${r.path}`,
  }))
);
/** 期望顺序 = #1 日结、#2 提成结算、#3 支付核销、#4 收据核销、#5 应收收款 */
// S3-195：门店路由收窄后，「应收收款」的前缀由 /api/store 变为 /api/store/receivables，router 内路径随之变短
// （对外 URL 逐字不变：/api/store/receivables/AR202601/payment）。
const F4_EXPECTED_PATHS = ["/daily-settlements", "/settle", "/PAY202601/writeoff", "/RC202601/writeoff", "/AR202601/payment"];
/** 角色 × 5 端点期望矩阵（口径 = 派单卡「验收标准⑤」，匹配语义 = F1 的 matchPermission） */
const F4_ROLES: { name: string; uid: number; expectPass: boolean[] }[] = [
  { name: "STORE_OPERATOR（F4 订正后：只持有 finance:daily-settle）", uid: 9008, expectPass: [true, false, false, false, false] },
  { name: "STORE_MANAGER（F4 订正后：finance:payment + finance:daily-settle）", uid: 9009, expectPass: [true, true, true, true, true] },
  { name: "FINANCE_STAFF（finance:* 域通配）", uid: 9006, expectPass: [true, true, true, true, true] },
  { name: "READONLY（*:view 动作通配）", uid: READONLY_USER, expectPass: [false, false, false, false, false] },
];

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

/**
 * 发起请求。
 *
 * S3-177 同步（契约变化，不是放宽断言）：`payment`/`aftersale`/`miniapp` 三个 `auth:"none"` 文件的写端点
 * 补挂了**端点级** `csrfMiddleware`（顺序 `requireAuthWithTenant → csrfMiddleware → requirePermission`），
 * 与挂载层契约一致——csrf 先于路由匹配（见本文件 :368 注释、踩坑[34]）。
 * 因此 `rawMount=true`（模拟 `auth:"none"` 挂载）的写请求**现在也要**携带有效 `x-csrf-token`：
 * 该 token 由端点级 csrfMiddleware 按 `req.user.id` 校验，不携带会先被拦成「CSRF token 无效或缺失」，
 * 从而掩盖真实的权限判定结果（本文件 a) 403 文案 / b) 200 用例即因此变红）。
 */
function call(app: express.Express, method: Method, url: string, uid?: number, rawMount?: boolean) {
  const req = request(app)[method](url);
  if (uid) {
    if (rawMount) req.set("Authorization", `Bearer ${tenantToken(uid)}`).set("x-csrf-token", generateCsrfToken(uid));
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
/**
 * S3-227 A：机读台账（`guard-rbac-wiring` 的已登记缺口台账）。
 * 本用例的「跨批接线数」不再用裸数字断言，而是拿台账的 `_counts` 作**第二真值源**核对（见下方用例）。
 */
const BASELINE_PATH = fileURLToPath(new URL("../../../scripts/rbac-wiring-baseline.json", import.meta.url));

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
  for (const m of MODULES) appFor(m.file, m.prefix, m.router, m.rawMount);
});

describe("S3-122-F2 G0 接线 · 接线数与名单一致（验收标准③）", () => {
  // S3-122-G1 追加说明：本断言是"全量接线总数"快照，G1 新增 8 处接线后总数由 32 → 40。
  // 这里只同步"总数 + 逐文件计数"的期望值（新增 G1_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（对比见 G1 回传卡「风险与自我报备」第 1 条）。
  const G1_WIRED_FILES = new Map<string, number>([
    ["bank-account.routes.ts", 2],
    ["payment.routes.ts", 1],
    ["store-value-card.routes.ts", 1],
    ["admin-marketing-flash-sale.routes.ts", 4],
  ]);
  const G1_WIRED_TOTAL = [...G1_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-126（G1b）追加说明：G1 判为「待裁 A 类」的 8 行改挂域内细码接线后，总数由 40 → 48。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_126_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言一字未动（对比见 S3-126 回传卡「风险与自我报备」第 1 条）。
  const S3_126_WIRED_FILES = new Map<string, number>([
    ["credit.routes.ts", 7],
    ["commission.routes.ts", 1],
  ]);
  const S3_126_WIRED_TOTAL = [...S3_126_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-125（G2）追加说明：G2 新增 1 处接线（expense.routes.ts 的 POST "/"）后总数由 48 变 49。
  // 同样只同步总数与逐文件计数快照（新增 G2_WIRED_FILES）；其余断言一字未动。
  const G2_WIRED_FILES = new Map<string, number>([["expense.routes.ts", 1]]);
  const G2_WIRED_TOTAL = [...G2_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // C6-4-1 追加说明：C6-4-1（商品库 COPY 调取）在 admin-library.routes.ts 新增 4 处接线
  // （GET /spus、GET /spus/:id、GET /copies、POST /copies）后总数由 49 → 53。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 C6_4_1_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言一字未动（对比见 C6-4-1-F2 回传卡「交付物①」）。
  const C6_4_1_WIRED_FILES = new Map<string, number>([["admin-library.routes.ts", 4]]);
  const C6_4_1_WIRED_TOTAL = [...C6_4_1_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-142 追加说明：S3-142（手工建品补挂权限点）在 admin-product.routes.ts 新增 1 处接线
  // （POST /products 挂既有码 goods:create）后总数由 53 → 54。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_142_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言一字未动。
  const S3_142_WIRED_FILES = new Map<string, number>([["admin-product.routes.ts", 1]]);
  const S3_142_WIRED_TOTAL = [...S3_142_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-180 追加说明：S3-180（批B2-1 报表域试点）在 admin-report.routes.ts 新增 2 处接线
  // （POST /collection-links/:linkNo/revoke、POST /sale-bills/batch-collection-link，均挂既有码
  // report:finance）后总数由 54 → 56。同样只同步"总数 + 逐文件计数"的期望值（新增 S3_180_WIRED_FILES）；
  // G0 名单行与其逐行 403/200 断言一字未动（见 S3-180 回传卡「风险与自我报备」）。
  const S3_180_WIRED_FILES = new Map<string, number>([["admin-report.routes.ts", 2]]);
  const S3_180_WIRED_TOTAL = [...S3_180_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-198 追加说明：S3-198（批B2-2 库存/追溯域）在 5 个路由文件新增 25 处接线
  // （data-transfer 2 / inventory-batch 7 / inventory-share 6 / transfer-order 7 / warehouse 3；
  // 全部挂**既有**权限码：inventory:create|adjust|approve、store:transfer）后总数由 56 → 81。
  // 返工（凌舟裁定 R101-S3-198 §二.①）：trace.routes.ts 原计划的 9 处 trace:code 接线**全部退回**
  // （生产 t_sys_role.permissions 实测门店角色不含 trace:*）⇒ 34 → 25，故本表不含 trace.routes.ts。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_198_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-198-inventory-wiring.test.ts）。
  const S3_198_WIRED_FILES = new Map<string, number>([
    ["data-transfer.routes.ts", 2],
    ["inventory-batch.routes.ts", 7],
    ["inventory-share.routes.ts", 6],
    ["transfer-order.routes.ts", 7],
    ["warehouse.routes.ts", 3],
  ]);
  const S3_198_WIRED_TOTAL = [...S3_198_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-209 追加说明：S3-209（销售单取消端点 · 跨线 P1）在 admin-order.routes.ts 新增 1 处接线
  // （POST /sale-bills/:billNo/cancel，挂**本单新立**的权限码 sale:cancel）后总数由 81 → 82。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_209_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本单的逐行 403/200 断言在 s3-209-sale-cancel-wiring.test.ts）。
  const S3_209_WIRED_FILES = new Map<string, number>([["admin-order.routes.ts", 1]]);
  const S3_209_WIRED_TOTAL = [...S3_209_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-214-B2 追加说明：S3-214-B2（批B2-2 采购域 阶段②）在 8 个路由文件新增 25 处接线
  // （purchase-contract 4 / purchase-in-stock 2 / purchase-payment 2 / purchase-return 2 / purchase 4 /
  //  supplier-contact 4 / supplier-statement 3 / supplier 4；全部挂**既有**权限码：
  //  purchase:create|approve|supplier、inventory:inbound、finance:payment、sale:return、report:finance）
  // 后总数由 82 → 107。同样只同步"总数 + 逐文件计数"的期望值（新增 S3_214_WIRED_FILES）；
  // G0 名单行与其逐行 403/200 断言**一字未动**（本批的逐行 403/200 断言在
  // rbac-b2-s3-214-purchase-wiring.test.ts）。
  const S3_214_WIRED_FILES = new Map<string, number>([
    ["purchase-contract.routes.ts", 4],
    ["purchase-in-stock.routes.ts", 2],
    ["purchase-payment.routes.ts", 2],
    ["purchase-return.routes.ts", 2],
    ["purchase.routes.ts", 4],
    ["supplier-contact.routes.ts", 4],
    ["supplier-statement.routes.ts", 3],
    ["supplier.routes.ts", 4],
  ]);
  const S3_214_WIRED_TOTAL = [...S3_214_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-222 追加说明：S3-222（批B2-4 客户域接线）在 11 个路由文件新增 42 处接线
  // （admin-customer 6 / customer-care 4 / customer-merge 1 / customer-payment 2 / customer-price 3 /
  //  customer-segment 4 / customer-statement 2 / customer-tag 5 / customer-type 3 / customer-visit 5 /
  //  tag.routes 7；全部挂**既有**权限码：customer:create|edit|visit|statement|payment）后总数由 107 → 149。
  // 本域另有 3 行**本批不接**（member-register 2 条真公开端点 + customer-statement confirm 1 条待授权模型定案），
  // 故 12 个文件里 member-register.routes.ts 计数为 0。同样只同步"总数 + 逐文件计数"的期望值
  // （新增 S3_222_WIRED_FILES）；G0 名单行与其逐行 403/200 断言**一字未动**（本批的逐行 403/200 断言在
  // rbac-b2-s3-222-customer-wiring.test.ts）。
  const S3_222_WIRED_FILES = new Map<string, number>([
    ["admin-customer.routes.ts", 6],
    ["customer-care.routes.ts", 4],
    ["customer-merge.routes.ts", 1],
    ["customer-payment.routes.ts", 2],
    ["customer-price.routes.ts", 3],
    ["customer-segment.routes.ts", 4],
    ["customer-statement.routes.ts", 2],
    ["customer-tag.routes.ts", 5],
    ["customer-type.routes.ts", 3],
    ["customer-visit.routes.ts", 5],
    ["tag.routes.ts", 7],
  ]);
  const S3_222_WIRED_TOTAL = [...S3_222_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-220 追加说明：S3-220（批B2-3 商品域 45 条里的 15 条）在 4 个路由文件新增 15 处接线
  // （admin-product 3 / product-bundle 8 / product-review 1 / unit 3；全部挂**既有**权限码：
  //  goods:create|edit|delete）后总数由 107 → 122。
  //  两处价格端点**本批不接**（故 price.routes.ts 不在本表）：`POST /prices/best-price` 是 G0 已锁定的
  //  「查询型 POST（待裁定）」、`POST /prices/batch/preview` 是 G0 已锁定的 price-guard 行为 ⇒ 不动。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_220_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-220-product-wiring.test.ts）。
  const S3_220_WIRED_FILES = new Map<string, number>([
    ["admin-product.routes.ts", 3],
    ["product-bundle.routes.ts", 8],
    ["product-review.routes.ts", 1],
    ["unit.routes.ts", 3],
  ]);
  const S3_220_WIRED_TOTAL = [...S3_220_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-224 追加说明：S3-224（第 43 项续 · B2 批 6 销售域 87 条仍缺口里的 32 条）在 11 个路由文件
  // 新增 32 处接线（全部挂**既有**权限码：sale:create / sale:edit / sale:void / sale:return /
  // finance:daily-settle）后总数由 183 → 215（与已合并的 S3-223 快照叠加：183 + 32 = 215）。
  //  本域另有 55 条**本批不接**（40 条 B 类「app-mobile 使用者集合不可枚举」＋2 条 G0/G1/G2 锁定＋
  //  1 条查询型 POST＋3 条真公开回调＋6 条消费者端形态＋3 条待授权模型定案），
  //  故 instant-retail-admin-ops / instant-retail-admin-platform / instant-retail-webhook /
  //  order-exception / position / cart 六个文件**不在本表**。
  //  同样只同步"总数 + 逐文件计数"的期望值（新增 S3_224_WIRED_FILES）；G0 名单行与其逐行 403/200
  //  断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-224-sales-wiring.test.ts）。
  const S3_224_WIRED_FILES = new Map<string, number>([
    ["admin-marketing-flash-sale.routes.ts", 2],
    ["admin-order.routes.ts", 3],
    ["admin-quote-push.routes.ts", 2],
    ["aftersale.routes.ts", 1],
    ["commerce-fix.routes.ts", 4],
    ["instant-retail-store.routes.ts", 4],
    ["order-timeout.routes.ts", 3],
    ["sale-return.routes.ts", 2],
    ["store-order.routes.ts", 6],
    ["store-sale-bill.routes.ts", 1],
    ["store-shift.routes.ts", 4],
  ]);
  const S3_224_WIRED_TOTAL = [...S3_224_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-223 追加说明：S3-223（财务域 9 文件 / 28 写端点 · B2 批 5）在 7 个路由文件新增 19 处接线
  // （bank-account 1 / commission 2 / credit 5 / expense 3 / payment-config 6 / payment-new 1 / receipt 1；
  //  全部挂**既有**权限码：finance:create、finance:payment、finance:receipt:create、sale:commission、customer:credit）
  // 后总数由 164 → 183（与已合并的 S3-222 快照叠加：122 + 42 = 164）。
  // 本域另有 9 行**本批不接**（5 行 B 类待裁 + 3 行 G0 范围控制锁定 + 1 行公开回调），
  // 故 reconciliation.routes.ts / payment.routes.ts 两文件计数为 0。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_223_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-223-finance-wiring.test.ts）。
  const S3_223_WIRED_FILES = new Map<string, number>([
    ["bank-account.routes.ts", 1],
    ["commission.routes.ts", 2],
    ["credit.routes.ts", 5],
    ["expense.routes.ts", 3],
    ["payment-config.routes.ts", 6],
    ["payment-new.routes.ts", 1],
    ["receipt.routes.ts", 1],
  ]);
  const S3_223_WIRED_TOTAL = [...S3_223_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-225 追加说明：S3-225（员工/账号域 7 文件 / 31 写端点 · B2 批 7）在 4 个路由文件新增 11 处接线
  // （admin-staff 1 / sys-user 3 / rbac 2 / data-permission 5；全部挂**既有**权限码：
  //  system:user:create、system:user:edit、system:role:create、system:role:edit，均见 079_权限矩阵.sql:270-273）
  // 后总数由 215 → 226（与已合并的 S3-222/S3-223/S3-224 快照叠加：122 + 42 + 19 + 32 = 215）。
  // 本域另有 20 行**本批不接**（B 类 7 + 自服务 7 + 自服务实际用途 1 + 查询型 POST 1 + 需新立码 4），
  // 故 admin-auth.routes.ts / department.routes.ts / user-session.routes.ts 三个文件计数为 0
  // （其余四个接线文件仍有剩余缺口行，计数见下）。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_225_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-225-staff-wiring.test.ts）。
  const S3_225_WIRED_FILES = new Map<string, number>([
    ["admin-staff.routes.ts", 1],
    ["sys-user.routes.ts", 3],
    ["rbac.routes.ts", 2],
    ["data-permission.routes.ts", 5],
  ]);
  const S3_225_WIRED_TOTAL = [...S3_225_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-226 追加说明：S3-226（第 43 项续 · B2 批 8 营销域 89 写端点里的 65 条）在 15 个路由文件
  // 新增 65 处接线（全部挂**既有**权限码：marketing:create / marketing:points）后总数由 215 → 280。
  // 本域另有 24 条**本批不接**（1 条查询型 POST ＋ 9 条 B 类「app-mobile 使用者集合不可枚举」＋
  // 14 条 W 类「页面可见角色含 READONLY / 旧词表 STORE_ADMIN / 店长 / 销售 / 客服 ⇒ 接线即 403」），
  // 故 admin-marketing-calculation / community-marketing / store-coupon 三个文件**不在本表**。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_226_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-226-marketing-wiring.test.ts）。
  const S3_226_WIRED_FILES = new Map<string, number>([
    ["admin-marketing-coupon.routes.ts", 3],
    ["admin-marketing-full-reduction.routes.ts", 2],
    ["admin-marketing-group-buy.routes.ts", 6],
    ["admin-marketing-points.routes.ts", 1],
    ["admin-marketing-stack-rule.routes.ts", 3],
    ["marketing-asset.routes.ts", 3],
    ["marketing-gift-rule.routes.ts", 8],
    ["marketing-limited-discount.routes.ts", 7],
    ["marketing-material.routes.ts", 8],
    ["marketing-points-mall.routes.ts", 7],
    ["points-mall.routes.ts", 6],
    ["points.routes.ts", 2],
    ["retail-announcement.routes.ts", 3],
    ["retail-announcements-admin.routes.ts", 3],
    ["seckill.routes.ts", 3],
  ]);
  const S3_226_WIRED_TOTAL = [...S3_226_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-229（收口总清单第 43 项续 · B2 批 9）：门店/租户域 + 营销域 W 类共 **17 条**已接线
  //   （demo 2 + store-control 5 + community-marketing 10；`admin-store` / `store-value-card` / `store` /
  //   `points` 的 W 与 B 类行、平台侧与平台域行**不在本表**，见 docs/tasks/R101-RBAC接线缺口清单.md §十七）。
  // 同样只同步"总数 + 逐文件计数"的期望值（新增 S3_229_WIRED_FILES）；G0 名单行与其逐行 403/200
  // 断言**一字未动**（本批的逐行 403/200 断言在 rbac-b2-s3-229-store-and-marketing-wiring.test.ts）。
  const S3_229_WIRED_FILES = new Map<string, number>([
    ["demo.routes.ts", 2],
    ["store-control.routes.ts", 5],
    ["community-marketing.routes.ts", 10],
  ]);
  const S3_229_WIRED_TOTAL = [...S3_229_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-231（收尾批 · F1）：`points.routes.ts` 会员等级配置 4 条改挂 `customer:level`
  //   （凌舟裁定 1，见 `R101-S3-229-凌舟验收与裁定.md` §二.1 / `docs/tasks/R101-RBAC接线缺口清单.md` §十八）。
  //   ⚠️ 与既往「整文件新增批次」不同：本批落在**已进入 S3_226 行**的同一文件（`points.routes.ts`）上。
  //     处置：**不改 S3-226 那行**（它的 2 是"营销积分规则增/改"的原始声明值，改它等于抹掉别人的声明），
  //     改为把两个常量块的**逐文件贡献相加**（下方 `expected` 的折叠循环用 `+=` 而非 `=`）⇒
  //     逐文件读数 2 + 4 = 6、总数 8 + … + 65 + 17 + 4 = 312，两处声明都保留在案、可分别追溯。
  const S3_231_WIRED_FILES = new Map<string, number>([["points.routes.ts", 4]]);
  const S3_231_WIRED_TOTAL = [...S3_231_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-233（B 类收编第一批：把 S3-230 的入口权限门对应端点正式接线）追加说明：
  //   **57 处**新增接线（跨 7 个域、21 个路由文件；全部挂**既有**权限码，不新立码、不改角色种子、不动迁移）：
  //     销售域 5（admin-order 1 / store-order 2 / store-sale-bill 1 / receipt 1）＋采购域 4
  //     ＋库存追溯域 20（stock-check 9 / transfer 8 / stock-warning 1 / store-inventory 1 / inventory-loss-gain 1）
  //     ＋商品域 12（admin-product 8 / category 4）＋员工账号域 7（admin-staff 4 / rbac 3）
  //     ＋营销域 5（admin-marketing-coupon 2 / admin-marketing-full-reduction 3）＋财务域 4（bank-account 2 / reconciliation 2）。
  //   逐条判定与依据门见 `docs/tasks/R101-RBAC接线缺口清单.md` §十八；本批的逐行 403/200 断言在
  //   `rbac-b2-s3-233-gate-wiring-parity.test.ts`（跨层一致性）与各域批次用例里（收编行随原用例走既有两侧断言）。
  //   ⚠️ 跨批计数纪律（S3-227 §9.2）：只新增本批自己的常量块，不重排他人行；总数只写和式。
  const S3_233_WIRED_FILES = new Map<string, number>([
    ["admin-order.routes.ts", 1],
    ["store-order.routes.ts", 2],
    ["store-sale-bill.routes.ts", 1],
    ["receipt.routes.ts", 1],
    ["purchase.routes.ts", 1],
    ["purchase-in-stock.routes.ts", 1],
    ["purchase-return.routes.ts", 1],
    ["purchase-payment.routes.ts", 1],
    ["stock-check.routes.ts", 9],
    ["stock-warning.routes.ts", 1],
    ["store-inventory.routes.ts", 1],
    ["inventory-loss-gain.routes.ts", 1],
    ["transfer.routes.ts", 8],
    ["admin-product.routes.ts", 8],
    ["category.routes.ts", 4],
    ["admin-staff.routes.ts", 4],
    ["rbac.routes.ts", 3],
    ["admin-marketing-coupon.routes.ts", 2],
    ["admin-marketing-full-reduction.routes.ts", 3],
    ["bank-account.routes.ts", 2],
    ["reconciliation.routes.ts", 2],
  ]);
  const S3_233_WIRED_TOTAL = [...S3_233_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  // S3-237（接线批 10：系统设置/基础域 10 条 + 商品 A 类 7 条）追加说明：
  //   **17 处**新增接线，全部挂**既有/已立**码（不新立码、不改角色种子、不动迁移）：
  //     组 1 系统设置/基础域 10（alert 3 = system:alert:handle|rule-edit|check、archive 1 = system:archive:execute、
  //       notification 1 = system:notification:send、push 1 = system:push:test、sms-template 3 = system:sms-template:*、
  //       system 1 = system:migration:run；码由 S3-232 的目录 `system-permission-codes.ts` + 迁移 204 落地）
  //     ＋组 2 商品 A 类 7（admin-product 1 = products/skus/:skuId/barcode、brand 2、product-marketing-tag 2、
  //       unit-group 2；全部挂 079 既有码 goods:create|edit，店长经 D1/204 持有 ⇒ 零回归）。
  //   本批另有 **12 条不接**（4 条手机端通知写端点「消息页无权限门」＋3 条 DELETE「D1 不含 goods:delete，按 D4 前端补门」
  //     ＋4 条审核端点「079/204 均无审核类码」＋1 条 products/import「无真实调用点」），
  //   故 notification.routes.ts 仍留在表内（计 1，而非其缺口的 5）、brand / product-marketing-tag / unit-group 各计 2（不是 3），
  //   admin-product.routes.ts 走累加（S3-220 的 3 + S3-233 的 8 + 本批 1，同文件另有 S3-142 等既有接线）。
  //   逐条判定与证据见 `docs/tasks/R101-RBAC接线缺口清单.md` §二十；逐行 403/200 断言在
  //   `rbac-b2-s3-237-system-wiring.test.ts` / `rbac-b2-s3-237-goods-wiring.test.ts`。
  const S3_237_WIRED_FILES = new Map<string, number>([
    ["alert.routes.ts", 3],
    ["archive.routes.ts", 1],
    ["notification.routes.ts", 1],
    ["push.routes.ts", 1],
    ["sms-template.routes.ts", 3],
    ["system.routes.ts", 1],
    ["admin-product.routes.ts", 1],
    ["brand.routes.ts", 2],
    ["product-marketing-tag.routes.ts", 2],
    ["unit-group.routes.ts", 2],
  ]);
  const S3_237_WIRED_TOTAL = [...S3_237_WIRED_FILES.values()].reduce((a, b) => a + b, 0);

  it("backend/src/routes 下 `requirePermission(` 出现次数 = G0 名单条数 32 + G1 新增 8 + S3-126 新增 8 + G2 新增 1 + C6-4-1 新增 4 + S3-142 新增 1 + S3-180 新增 2 + S3-198 新增 25 + S3-209 新增 1 + S3-214 新增 25 + S3-220 新增 15 + S3-222 新增 42 + S3-223 新增 19 + S3-224 新增 32 + S3-225 新增 11 + S3-226 新增 65 + S3-229 新增 17 + S3-231 新增 4 + S3-233 新增 57 + S3-237 新增 17", () => {
    const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));
    const perFile = new Map<string, number>();
    let total = 0;
    for (const f of files) {
      const src = readFileSync(path.join(ROUTES_DIR, f), "utf8");
      const n = (src.match(/requirePermission\(/g) ?? []).length;
      if (n > 0) perFile.set(f, n);
      total += n;
    }
    expect(total).toBe(G0_TOTAL + G1_WIRED_TOTAL + S3_126_WIRED_TOTAL + G2_WIRED_TOTAL + C6_4_1_WIRED_TOTAL + S3_142_WIRED_TOTAL + S3_180_WIRED_TOTAL + S3_198_WIRED_TOTAL + S3_209_WIRED_TOTAL + S3_214_WIRED_TOTAL + S3_220_WIRED_TOTAL + S3_222_WIRED_TOTAL + S3_223_WIRED_TOTAL + S3_224_WIRED_TOTAL + S3_225_WIRED_TOTAL + S3_226_WIRED_TOTAL + S3_229_WIRED_TOTAL + S3_231_WIRED_TOTAL + S3_233_WIRED_TOTAL + S3_237_WIRED_TOTAL);

    // S3-227 A（本单）：删除原 `expect(total).toBe(226)` 裸数字断言。
    //   为什么删：那是一个跨批共享的**单点数字**，每批都要改同一行（批 3⇒149、批 5⇒183、批 6⇒215、批 7⇒226 …），
    //   两批并行时合并只能"取一侧" ⇒ 另一批的接线数被**静默抹掉**且仍显示绿（S3-225 亲历：被迫改 215→226）。
    //   现在只保留两类判据：① 上面的**和式**（声明侧的唯一总数来源，每批只加自己那一项）；
    //   ② 下面的**台账一致性**（机读台账 `_counts` 作第二真值源）。
    //   "漏声明"仍由本用例下方的逐文件 map 断言（`perFile` × `expected`）+ `guard-rbac-wiring --strict` 共同兜住。
    const ledger = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
      _counts: {
        files: number;
        endpoints: number;
        consumerEndFiles: number;
        consumerEndEndpoints: number;
        readOnlyPostEndpoints: number;
        wiredEndpoints: number;
        scannedEndpoints: number;
        wiredPermOccurrences: number;
      };
    };
    // ② 台账一致性（本用例口径）：源码里 `requirePermission(` 的出现次数必须等于台账 `_counts.wiredPermOccurrences`。
    //    ⚠️ 口径提示：本用例数的是"出现次数"，与台账 `_counts.wiredEndpoints`（门禁口径：authForm ∈ inline/use-mount
    //    的**写端点**数）**不是同一个数**，差值有确定来源：门禁口径 − 本用例口径
    //      = 平台侧 `requirePlatformPermission` 端点（本用例不数，+32）
    //        − 挂在**非写端点**（如 GET 路由）上的 `requirePermission(` 出现次数（−3，admin-library.routes.ts）
    //        ± 被 `router.use(scope, requirePermission())` 一次覆盖多个写端点的差额（当前为 0）。
    //    逐文件对照见 docs/evidence/S3-227/10-metric-diff.txt（255 − 226 = 29 = 32 − 3 + 0）。
    expect(total).toBe(ledger._counts.wiredPermOccurrences);
    // ③ 台账自洽：各类写端点之和 == 扫描总数（缺口 + 消费者端保护形态 + 查询型 POST 登记 + 已接线）
    //    ⇒ 台账不能被单侧改动（S3-227 C 起含 `readOnlyPostEndpoints`）。
    expect(
      ledger._counts.endpoints +
        ledger._counts.consumerEndEndpoints +
        ledger._counts.readOnlyPostEndpoints +
        ledger._counts.wiredEndpoints
    ).toBe(ledger._counts.scannedEndpoints);

    const expected = new Map<string, number>();
    for (const m of MODULES) expected.set(m.file, (expected.get(m.file) ?? 0) + m.rows.length);
    for (const [f, n] of G1_WIRED_FILES) expected.set(f, (expected.get(f) ?? 0) + n);
    for (const [f, n] of S3_126_WIRED_FILES) expected.set(f, (expected.get(f) ?? 0) + n);
    for (const [f, n] of G2_WIRED_FILES) expected.set(f, (expected.get(f) ?? 0) + n);
    for (const [f, n] of [...C6_4_1_WIRED_FILES, ...S3_142_WIRED_FILES, ...S3_180_WIRED_FILES, ...S3_198_WIRED_FILES, ...S3_209_WIRED_FILES, ...S3_214_WIRED_FILES, ...S3_220_WIRED_FILES, ...S3_222_WIRED_FILES, ...S3_223_WIRED_FILES, ...S3_224_WIRED_FILES, ...S3_225_WIRED_FILES, ...S3_226_WIRED_FILES, ...S3_229_WIRED_FILES, ...S3_231_WIRED_FILES, ...S3_233_WIRED_FILES, ...S3_237_WIRED_FILES])
      // ⚠️ S3-231 F1：同文件可被**两个批次**声明（points.routes.ts = S3-226 的 2 + S3-231 的 4）
      //    ⇒ 必须**累加**；用 `set(f, n)` 会让后一个块**覆盖**前一个块的声明（抹掉他人接线数）。
      //    S3-233（本批）同规则：`admin-product.routes.ts` 等若与既有块同文件，也走累加。
      expected.set(f, (expected.get(f) ?? 0) + n);
    expect([...perFile.entries()].sort()).toEqual([...expected.entries()].sort());
  });

  it("每条 G0 名单行都能在对应路由文件中找到 `requirePermission(\"<permCode>\")`（且不带通配）", () => {
    for (const m of MODULES) {
      const src = readFileSync(path.join(ROUTES_DIR, m.file), "utf8");
      for (const perm of new Set(m.rows.map((r) => r.perm))) {
        expect(src).toContain(`requirePermission("${perm}")`);
        expect(src).not.toContain(`requirePermission("${perm.slice(0, perm.indexOf(":"))}:*")`);
      }
    }
  });
});

describe("S3-122-F2 G0 接线 · a) 只读账号被拦（验收标准④ 常规面）", () => {
  it.each(G0_CASES)("$label：READONLY（*:view）⇒ 403 且未到达业务层", async (row) => {
    const res = await call(
      appFor(row.file, row.prefix, row.router, row.rawMount),
      row.method,
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

describe("S3-122-F2 G0 接线 · b) 有权角色照常通过（验收标准⑤ 不锁死）", () => {
  it.each(ALLOWED_PAIRS)(
    "$label：$uid（$file 的许可角色）⇒ 到达业务层（非 403）",
    async (row) => {
      const res = await call(
        appFor(row.file, row.prefix, row.router, row.rawMount),
        row.method,
        `${row.prefix}${row.path}`,
        row.uid,
        row.rawMount
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.handler).toBe("string");
      expect(h.reached.length).toBeGreaterThan(0);
    }
  );

  it("卡面点名：SALES_STAFF（[\"sale:create\",…]）调 POST /api/store/sale-bills ⇒ 到达业务层", async () => {
    // S3-195：收窄后前缀 = /api/store/sale-bills（对外 URL 不变）
    const res = await call(appFor("store-sale-bill.routes.ts", "/api/store/sale-bills", storeSaleBillRouter), "post", "/api/store/sale-bills", 9003);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("卡面点名：SUPER_ADMIN（[\"*\"]）调 G0 高风险写（库存调整）⇒ 到达业务层", async () => {
    const res = await call(
      appFor("store-inventory.routes.ts", "/api/store/inventory", storeInventoryRouter),
      "post",
      "/api/store/inventory/adjust",
      SUPER_ADMIN_USER
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("域通配符（F1 产物）在 G0 上真实生效：STORE_MANAGER/WAREHOUSE_STAFF 的 inventory:* 通过 inventory:adjust", async () => {
    for (const uid of [9004, 9005]) {
      const res = await call(appFor("store-inventory.routes.ts", "/api/store/inventory", storeInventoryRouter), "post", "/api/store/inventory/adjust", uid);
      expect(res.status).toBe(200);
    }
  });

  it("同一 Router 的第二挂载点同样受门禁保护（/api/store/sale-returns/:returnNo/refund）", async () => {
    const readonly = await call(buildApp("/api/store/sale-returns", saleReturnRouter), "post", "/api/store/sale-returns/SR1/refund", READONLY_USER);
    expect(readonly.status).toBe(403);
    expect(readonly.body.msg).toBe("无权限执行此操作，需要权限: sale:return");

    const manager = await call(buildApp("/api/store/sale-returns", saleReturnRouter), "post", "/api/store/sale-returns/SR1/refund", 9004);
    expect(manager.status).toBe(200);
  });
});

describe("S3-122-F2 G0 接线 · c) 未登录 401（既有行为不变）", () => {
  it.each(G0_CASES)("$label：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-122-F4 日结权限点拆分 · 角色 × 5 端点复算（验收标准⑤）", () => {
  it("五条端点名单与顺序固定：#1 日结 / #2 提成结算 / #3 支付核销 / #4 收据核销 / #5 应收收款", () => {
    expect(F4_ROWS.length).toBe(5);
    expect(F4_ROWS.map((r) => r.path)).toEqual(F4_EXPECTED_PATHS);
    expect(F4_ROWS[0].perm).toBe("finance:daily-settle");
    for (const row of F4_ROWS.slice(1)) expect(row.perm).toBe("finance:payment");
  });

  it.each(F4_ROLES)("$name：逐端点判定与预期矩阵一致（#1 日结 + #2–#5 收款类）", async (role) => {
    const observed: boolean[] = [];
    const detail: string[] = [];
    for (const row of F4_ROWS) {
      const res = await call(
        appFor(row.file, row.prefix, row.router, row.rawMount),
        row.method,
        `${row.prefix}${row.path}`,
        role.uid,
        row.rawMount
      );
      const passed = res.status === 200;
      observed.push(passed);
      detail.push(`${row.label} ⇒ ${res.status}${passed ? "" : `（${res.body.msg ?? res.body.message ?? ""}）`}`);
      if (!passed) {
        expect(res.status, row.label).toBe(403);
        expect(res.body.msg, row.label).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
        expect(res.body.handler, row.label).toBeUndefined();
      }
    }
    expect(observed, detail.join(" | ")).toEqual(role.expectPass);
  });

  it("卡面点名：STORE_OPERATOR ⇒ #1 日结到达业务层，#2–#5 四个收款类端点全部 403", async () => {
    const operator = 9008;
    const daily = await call(appFor("admin-finance.routes.ts", "/api/admin", adminFinanceRouter), "post", "/api/admin/daily-settlements", operator);
    expect(daily.status).toBe(200);
    expect(daily.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);

    for (const row of F4_ROWS.slice(1)) {
      const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`, operator, row.rawMount);
      expect(res.status, row.label).toBe(403);
      expect(res.body.msg, row.label).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    }
  });
});

describe("S3-122-F2 G0 接线 · 范围控制：未纳入 G0 的端点不被拦（证明没扩大改动）", () => {
  const NOT_IN_G0: { label: string; prefix: string; router: Router; method: Method; path: string }[] = [
    // S3-214-B2（2026-10-16）订正：原「普通写 PUT /api/admin/purchase-orders/:orderNo」一行已由本批接线
    // （既有码 purchase:create）⇒ 从本名单移出（该行的 403/200 断言见 rbac-b2-s3-214-purchase-wiring.test.ts）。
    // S3-233（2026-10-16）再订正：原「普通写 POST /api/admin/purchase-orders（创建采购单）」一行**已接线**
    // （既有码 purchase:create）—— S3-214-B2 保留它的前提是"移动端采购页签无权限门"，该前提已由 S3-230
    // 的入口权限门（`purchase-sub-order`）修复 ⇒ 从本名单移出；该行的 403/200 断言见
    // rbac-b2-s3-233-gate-wiring-parity.test.ts（与 rbac-b2-s3-214-purchase-wiring.test.ts 的收编行）。
    { label: "查询型 POST /api/admin/prices/best-price（待裁定）", prefix: "/api/admin/prices", router: priceRouter, method: "post", path: "/best-price" },
    { label: "催收（归 G2）POST /api/admin/credits/collections", prefix: "/api/admin/credits", router: creditRouter, method: "post", path: "/collections" },
    { label: "储值卡充值（非退款行）POST /api/admin/store-value-cards/:cardNo/recharge", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", path: "/VC1/recharge" },
    { label: "普通写 POST /api/admin/payments-new/", prefix: "/api/admin/payments-new", router: paymentNewRouter, method: "post", path: "/" },
    { label: "幂等 POST /api/admin/commission/calculate", prefix: "/api/admin/commission", router: commissionRouter, method: "post", path: "/calculate" },
    { label: "普通写 POST /api/admin/sale-returns/（创建退货单）", prefix: "/api/admin/sale-returns", router: saleReturnRouter, method: "post", path: "/" },
    { label: "收款 POST /api/store/sale-bills/:billNo/payment（归 G2）", prefix: "/api/store/sale-bills", router: storeSaleBillRouter, method: "post", path: "/B1/payment" },
  ];

  it.each(NOT_IN_G0)("$label：READONLY 仍到达业务层（未被误拦）", async (row) => {
    const res = await call(appFor(row.label, row.prefix, row.router), row.method, `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("S3-122-F2 G0 接线 · 已知锁定（回传卡『需补角色权限』项，必须显式锁定而非掩盖）", () => {
  it("goods:price（12 条改价）无任何非超管角色持有 ⇒ 店长/销售/财务均 403（原因=权限点缺失，不是 matcher）", async () => {
    for (const uid of [9003, 9004, 9006]) {
      const res = await call(appFor("price.routes.ts", "/api/admin/prices", priceRouter), "post", "/api/admin/prices/levels", uid);
      expect(res.status).toBe(403);
      expect(res.body.msg).toBe("无权限执行此操作，需要权限: goods:price");
    }
  });

  it("既有 price-guard 门禁保持原样（未被本单改写）：READONLY 调 POST /api/admin/prices/batch/preview 仍是 PRICE_MANAGEMENT_DENIED", async () => {
    const res = await call(appFor("price.routes.ts", "/api/admin/prices", priceRouter), "post", "/api/admin/prices/batch/preview", READONLY_USER);
    expect(res.status).toBe(403);
    // 与本单权限点的 403 文案不同 ⇒ 可据此区分「被谁拦的」
    expect(res.body.code).toBe("PRICE_MANAGEMENT_DENIED");
    expect(res.body.message).toBe("仅管理员和门店店长可执行价格管理操作");
  });
});
