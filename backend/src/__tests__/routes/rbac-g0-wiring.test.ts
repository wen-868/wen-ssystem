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
    prefix: "/api/store",
    router: storeInventoryRouter,
    rows: [{ method: "post", path: "/inventory/adjust", perm: "inventory:adjust", allow: [SUPER_ADMIN_USER, 9004, 9005] }],
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
    prefix: "/api/store",
    router: storeSaleBillRouter,
    rows: [{ method: "post", path: "/sale-bills", perm: "sale:create", allow: [SUPER_ADMIN_USER, 9003, 9004] }],
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
    rows: [{ method: "post", path: "/daily-settlements", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
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
    prefix: "/api/store",
    router: storeReceivableRouter,
    rows: [{ method: "post", path: "/receivables/AR202601/payment", perm: "finance:payment", allow: [SUPER_ADMIN_USER, 9006] }],
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

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
  for (const m of MODULES) appFor(m.file, m.prefix, m.router, m.rawMount);
});

describe("S3-122-F2 G0 接线 · 接线数与名单一致（验收标准③）", () => {
  it("backend/src/routes 下 `requirePermission(` 出现次数 = G0 名单条数 32", () => {
    const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));
    const perFile = new Map<string, number>();
    let total = 0;
    for (const f of files) {
      const src = readFileSync(path.join(ROUTES_DIR, f), "utf8");
      const n = (src.match(/requirePermission\(/g) ?? []).length;
      if (n > 0) perFile.set(f, n);
      total += n;
    }
    expect(total).toBe(G0_TOTAL);
    expect(total).toBe(32);

    const expected = new Map(MODULES.map((m) => [m.file, m.rows.length]));
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
    const res = await call(appFor("store-sale-bill.routes.ts", "/api/store", storeSaleBillRouter), "post", "/api/store/sale-bills", 9003);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("卡面点名：SUPER_ADMIN（[\"*\"]）调 G0 高风险写（库存调整）⇒ 到达业务层", async () => {
    const res = await call(
      appFor("store-inventory.routes.ts", "/api/store", storeInventoryRouter),
      "post",
      "/api/store/inventory/adjust",
      SUPER_ADMIN_USER
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("域通配符（F1 产物）在 G0 上真实生效：STORE_MANAGER/WAREHOUSE_STAFF 的 inventory:* 通过 inventory:adjust", async () => {
    for (const uid of [9004, 9005]) {
      const res = await call(appFor("store-inventory.routes.ts", "/api/store", storeInventoryRouter), "post", "/api/store/inventory/adjust", uid);
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

describe("S3-122-F2 G0 接线 · 范围控制：未纳入 G0 的端点不被拦（证明没扩大改动）", () => {
  const NOT_IN_G0: { label: string; prefix: string; router: Router; method: Method; path: string }[] = [
    { label: "普通写 POST /api/admin/purchase-orders（创建采购单）", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "post", path: "/" },
    { label: "普通写 PUT /api/admin/purchase-orders/:orderNo", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "put", path: "/PO1" },
    { label: "查询型 POST /api/admin/prices/best-price（待裁定）", prefix: "/api/admin/prices", router: priceRouter, method: "post", path: "/best-price" },
    { label: "催收（归 G2）POST /api/admin/credits/collections", prefix: "/api/admin/credits", router: creditRouter, method: "post", path: "/collections" },
    { label: "储值卡充值（非退款行）POST /api/admin/store-value-cards/:cardNo/recharge", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", path: "/VC1/recharge" },
    { label: "普通写 POST /api/admin/payments-new/", prefix: "/api/admin/payments-new", router: paymentNewRouter, method: "post", path: "/" },
    { label: "幂等 POST /api/admin/commission/calculate", prefix: "/api/admin/commission", router: commissionRouter, method: "post", path: "/calculate" },
    { label: "普通写 POST /api/admin/sale-returns/（创建退货单）", prefix: "/api/admin/sale-returns", router: saleReturnRouter, method: "post", path: "/" },
    { label: "收款 POST /api/store/sale-bills/:billNo/payment（归 G2）", prefix: "/api/store", router: storeSaleBillRouter, method: "post", path: "/sale-bills/B1/payment" },
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
