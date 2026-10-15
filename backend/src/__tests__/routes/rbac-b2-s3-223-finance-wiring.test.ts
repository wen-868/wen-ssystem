/**
 * S3-223 · **财务域**（9 路由文件 / 28 写端点）权限接线验收测试（B2 批 5）
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-223.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.10（域明细）＋ §十三（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` 554 条 / 144 文件）
 * 基线：`origin/main` = `90119ef4`（本单开工时 `git fetch` 取真值，见回执 §三）
 *
 * 本文件要证明的六件事（对应派单卡 §三.1/§三.2/§三.5）：
 *  a) 本批已接 **19 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 19 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「页面/按钮真实使用者持有该码」逐条钉进测试）；
 *  d) 反证：**不持有**该码的账号一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 9 行（5 行 B 类待裁 + 3 行 G0 范围控制锁定 + 1 行公开回调）
 *     ⇒ 注册行级不含 `requirePermission(`，且 READONLY 仍能到达业务层（证明本批「没多接」，
 *     也没把待定项偷接；公开回调另证「保持免鉴权」）；且**与 G0/G1/G2 三个既有锁定名单交叉印证**；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 角色权限串：生产只读实值（`STORE_MANAGER` = 精确码 `finance:payment` + `finance:daily-settle`、
 *    `FINANCE_STAFF` = `finance:*`，见派单卡 §二.1）＋ 仓库种子（`079_权限矩阵.sql`，与
 *    `guard-rbac-wiring.mjs --holders` 同源）；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）＋
 *    `app-mobile/src/config/function-menu.ts` 的移动菜单码（收款管理 `finance:receipt`、费用支出 `finance:expenses`）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-223/` 下反测日志与回执 §五）。
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
        get(_target, prop) {
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
vi.mock("@controllers/admin/commission.controller", () => h.stub());
vi.mock("@controllers/admin/credit.controller", () => h.stub());
vi.mock("@controllers/admin/credit-adjust.controller", () => h.stub());
vi.mock("@controllers/admin/expense.controller", () => h.stub());
vi.mock("@controllers/admin/payment-config.controller", () => h.stub());
vi.mock("@controllers/admin/payment-new.controller", () => h.stub());
vi.mock("@controllers/admin/payment.controller", () => ({ createPaymentController: () => h.stub() }));
vi.mock("@controllers/admin/receipt.controller", () => h.stub());
vi.mock("@controllers/admin/reconciliation.controller", () => h.stub());

// ---- 权限判定：数据库读取打桩，匹配逻辑用生产真实的 matchPermission ----
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
import { commissionRouter } from "../../routes/commission.routes";
import { creditRouter } from "../../routes/credit.routes";
import { expenseRouter } from "../../routes/expense.routes";
import { paymentConfigRouter } from "../../routes/payment-config.routes";
import { paymentNewRouter } from "../../routes/payment-new.routes";
import { paymentRouter } from "../../routes/payment.routes";
import { receiptRouter } from "../../routes/receipt.routes";
import { reconciliationRouter } from "../../routes/reconciliation.routes";

/**
 * 测试账号：9002/9006/9009 = 生产只读实值；其余 = 仓库种子（079 / 099 旧词表口径），
 * 与 `guard-rbac-wiring.mjs --holders` 的 ROLE_PERMISSIONS_SEED 逐字同源。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9003: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  9004: {
    name: "store_manager_seed",
    roles: ["STORE_MANAGER"],
    perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*"],
  },
  9005: {
    name: "warehouse_staff",
    roles: ["WAREHOUSE_STAFF"],
    perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"],
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
  9008: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  /** 生产店长实值（派单卡 §二.1）：**精确码** finance:payment + finance:daily-settle，无 finance:* */
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
const FINANCE_STAFF = 9006;
const STORE_MANAGER_PROD = 9009;
const OPERATION_ADMIN_USER = 9010;

/** 本批**已接** 19 行：`path` = 测试 URL（`:param` 换成具体值），`routePath` = 注册用的路径模式 */
interface WiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: "post" | "put" | "delete";
  routePath: string;
  path: string;
  perm: string;
  /** 该行「页面/按钮真实使用者」的代表账号（零回归论证，注意：**不是**持有人全集的简化，见 holdersOf 断言） */
  users: number[];
  /** 使用者依据（写清页面/调用点，便于逐条复核） */
  why: string;
  /** true = 生产挂载链无 auth/csrf（`auth:"none"`，如 /api/pay） */
  rawMount?: boolean;
}

const WIRED: WiredRow[] = [
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    method: "put",
    routePath: "/:id",
    path: "/1",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "admin-web 银行账户页 router/index.ts:203 [SUPER_ADMIN] → views/finance/BankAccounts.vue:294（updateBankAccountForFinance）；同文件 G1 既有码，零移动端调用点",
  },
  {
    file: "commission.routes.ts",
    prefix: "/api/admin/commission",
    router: commissionRouter,
    method: "put",
    routePath: "/rules/:id",
    path: "/rules/1",
    perm: "sale:commission",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "提成规则页 router/index.ts:112 [SUPER_ADMIN, STORE_MANAGER] → views/sale/CommissionRules.vue:208；同文件 S3-126 既有码",
  },
  {
    file: "commission.routes.ts",
    prefix: "/api/admin/commission",
    router: commissionRouter,
    method: "delete",
    routePath: "/rules/:id",
    path: "/rules/1",
    perm: "sale:commission",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "同页删除按钮 views/sale/CommissionRules.vue:226",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "put",
    routePath: "/collections/:id",
    path: "/collections/1",
    perm: "customer:credit",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "催收（同文件 S3-126 既有码 customer:credit）；全仓无前端调用点（api/customer.ts:149 导出零引用）⇒ 零回归",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "post",
    routePath: "/collections/auto-generate",
    path: "/collections/auto-generate",
    perm: "customer:credit",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "同上（无调用点）",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "post",
    routePath: "/collections/batch-remind",
    path: "/collections/batch-remind",
    perm: "customer:credit",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "同上（无调用点）",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "put",
    routePath: "/:customerId/limit",
    path: "/1/limit",
    perm: "customer:credit",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "信用管理页 router/index.ts:163 [SUPER_ADMIN, STORE_MANAGER] → views/customer/CreditView.vue:279（updateCreditLimit）",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "put",
    routePath: "/:customerId/term",
    path: "/1/term",
    perm: "customer:credit",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "同页帐期调整（api/customer.ts:126 导出零引用；与 limit 同行同码）",
  },
  {
    file: "expense.routes.ts",
    prefix: "/api/admin/expenses",
    router: expenseRouter,
    method: "put",
    routePath: "/:expenseNo",
    path: "/E1",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER, FINANCE_STAFF],
    why: "费用管理页 router/index.ts:200 [SUPER_ADMIN] + app-mobile 费用支出模块（function-menu.ts:94，模块前缀 finance）；同文件 G2 既有码（无有效调用点：api/modules/expenses.ts:94 零引用）",
  },
  {
    file: "expense.routes.ts",
    prefix: "/api/admin/expenses",
    router: expenseRouter,
    method: "post",
    routePath: "/:expenseNo/approve",
    path: "/E1/approve",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER, FINANCE_STAFF],
    why: "桌面 views/finance/ExpensesView.vue:362/374 + app-mobile expenses.vue:178、expense-detail.vue:108",
  },
  {
    file: "expense.routes.ts",
    prefix: "/api/admin/expenses",
    router: expenseRouter,
    method: "post",
    routePath: "/:expenseNo/void",
    path: "/E1/void",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER, FINANCE_STAFF],
    why: "桌面 ExpensesView.vue:384 + app-mobile expenses.vue:203、expense-detail.vue:131（reject → /void）",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "put",
    routePath: "/configs/:provider",
    path: "/configs/wechat",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "支付配置页 router/index.ts:249 [SUPER_ADMIN] → views/system/PaymentConfigView.vue:491/510；无移动端调用点",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "post",
    routePath: "/configs/:provider/test",
    path: "/configs/wechat/test",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "同页「测试连接」PaymentConfigView.vue:548",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "post",
    routePath: "/bank-accounts",
    path: "/bank-accounts",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "本文件 bank-accounts 4 行的前端调用走的是 /admin/payment/bank-accounts（路径漂移，见报备）⇒ 有效使用者仅超管",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "put",
    routePath: "/bank-accounts/:id",
    path: "/bank-accounts/1",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "同上",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "delete",
    routePath: "/bank-accounts/:id",
    path: "/bank-accounts/1",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "同上",
  },
  {
    file: "payment-config.routes.ts",
    prefix: "/api/payment-config",
    router: paymentConfigRouter,
    method: "post",
    routePath: "/bank-accounts/:id/default",
    path: "/bank-accounts/1/default",
    perm: "finance:create",
    users: [SUPER_ADMIN_USER],
    why: "同上",
  },
  {
    file: "payment-new.routes.ts",
    prefix: "/api/admin/payments-new",
    router: paymentNewRouter,
    method: "post",
    routePath: "/:paymentNo/void",
    path: "/P1/void",
    perm: "finance:payment",
    users: [SUPER_ADMIN_USER, STORE_MANAGER_PROD],
    why: "付款单页 router/index.ts:198 [SUPER_ADMIN] → views/finance/PaymentsNewView.vue:369；同文件既有码（writeoff 行）；店长持精确码 finance:payment ⇒ 不因本行收窄",
  },
  {
    file: "receipt.routes.ts",
    prefix: "/api/admin/receipts",
    router: receiptRouter,
    method: "post",
    routePath: "/:receiptNo/void",
    path: "/RC1/void",
    perm: "finance:receipt:create",
    users: [SUPER_ADMIN_USER, FINANCE_STAFF],
    why: "收款单页 router/index.ts:197 [SUPER_ADMIN] → views/finance/ReceiptsView.vue:379 + app-mobile 收款管理页 receipts.vue:121（function-menu.ts:91 菜单码 finance:receipt，持有者=finance:* 角色）",
  },
];

/** 本批**未接** 9 行（逐条给类别与锁定锚点；注册行必须**不含**权限中间件） */
interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: "post" | "put" | "delete";
  routePath: string;
  path: string;
  kind: "B" | "G0" | "PUBLIC";
  reason: string;
}

const UNWIRED: UnwiredRow[] = [
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    method: "post",
    routePath: "/",
    path: "/",
    kind: "B",
    reason: "app-mobile 门店管理页 stores.vue:241（bankAccountsApi.create）；锁于 rbac-g1-wiring.test.ts:273 / rbac-g2-wiring.test.ts:232",
  },
  {
    file: "bank-account.routes.ts",
    prefix: "/api/admin/bank-accounts",
    router: bankAccountRouter,
    method: "post",
    routePath: "/:id/close",
    path: "/1/close",
    kind: "B",
    reason: "app-mobile 门店管理页 stores.vue:263（bankAccountsApi.close）；锁于 rbac-g1-wiring.test.ts:274 / rbac-g2-wiring.test.ts:244",
  },
  {
    file: "receipt.routes.ts",
    prefix: "/api/admin/receipts",
    router: receiptRouter,
    method: "post",
    routePath: "/",
    path: "/",
    kind: "B",
    reason: "app-mobile 开单页 create-sale.vue:2202（receiptApi.create）；锁于 rbac-g1-wiring.test.ts:275 / rbac-g2-wiring.test.ts:256",
  },
  {
    file: "reconciliation.routes.ts",
    prefix: "/api/admin/reconciliation",
    router: reconciliationRouter,
    method: "post",
    routePath: "/customer/:customerId/confirm",
    path: "/customer/1/confirm",
    kind: "B",
    reason: "app-mobile 对账页 reconciliation.vue:256（菜单码 finance:reconciliation 无 t_sys_menu 行）；锁于 rbac-g1-wiring.test.ts:276 / rbac-g2-wiring.test.ts:268",
  },
  {
    file: "reconciliation.routes.ts",
    prefix: "/api/admin/reconciliation",
    router: reconciliationRouter,
    method: "post",
    routePath: "/supplier/:supplierId/confirm",
    path: "/supplier/1/confirm",
    kind: "B",
    reason: "app-mobile 对账页 reconciliation.vue:258；锁于 rbac-g1-wiring.test.ts:277 / rbac-g2-wiring.test.ts:280",
  },
  {
    file: "payment-new.routes.ts",
    prefix: "/api/admin/payments-new",
    router: paymentNewRouter,
    method: "post",
    routePath: "/",
    path: "/",
    kind: "G0",
    reason: "落在 rbac-g0-wiring.test.ts 的 NOT_IN_G0「范围控制」名单（:704）；另锁于 rbac-g1-wiring.test.ts:283 / rbac-g2-wiring.test.ts:327",
  },
  {
    file: "commission.routes.ts",
    prefix: "/api/admin/commission",
    router: commissionRouter,
    method: "post",
    routePath: "/calculate",
    path: "/calculate",
    kind: "G0",
    reason: "落在 rbac-g0-wiring.test.ts 的 NOT_IN_G0「范围控制」名单（:705）",
  },
  {
    file: "credit.routes.ts",
    prefix: "/api/admin/credits",
    router: creditRouter,
    method: "post",
    routePath: "/collections",
    path: "/collections",
    kind: "G0",
    reason: "落在 rbac-g0-wiring.test.ts 的 NOT_IN_G0「范围控制」名单（:702）",
  },
  {
    file: "payment.routes.ts",
    prefix: "/api/pay",
    router: paymentRouter,
    method: "post",
    routePath: "/wx/callback",
    path: "/wx/callback",
    kind: "PUBLIC",
    reason: "微信支付回调：微信服务器直调，无登录态/无浏览器会话 ⇒ 按台账口径免鉴权（挂 csrfMiddleware 会把正常回调打成 403，见 payment.routes.ts:18-20）",
  },
];

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
const BACKEND_DIR = path.resolve(ROUTES_DIR, "..", "..");

/** 取某文件里"注册某方法 + 某路径模式"的**行**（跳过注释行）——踩坑[134]：判据必须落到注册行 */
function registrationLines(file: string, method: string, routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

/** 权限持有人集合：用生产同一份 matchPermission 对角色实值逐账号复算（非人工誊写） */
function holdersOf(perm: string): number[] {
  return Object.entries(USERS)
    .filter(([, u]) => matchPermission(u.perms, perm))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

/** 与生产挂载链等价（auth → tenant → csrf）的测试 App：req.user 由请求头注入 */
function buildApp(prefix: string, router: Router, rawMount?: boolean) {
  const app = express();
  app.use(express.json());
  if (rawMount) {
    app.use(prefix, router);
    return app;
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
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

function call(app: express.Express, method: string, url: string, uid?: number) {
  const req = (request(app) as any)[method](url);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(key: string, prefix: string, router: Router, rawMount?: boolean) {
  if (!APPS.has(key)) APPS.set(key, buildApp(prefix, router, rawMount));
  return APPS.get(key)!;
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("S3-223 · 名单自证（28 = 19 已接 + 9 不接）", () => {
  it("19 行已接 + 9 行不接 = 本域 28 写端点（与台账 §三.10 的 9 文件 / 28 端点守恒）", () => {
    expect(WIRED).toHaveLength(19);
    expect(UNWIRED).toHaveLength(9);
    expect(19 + 9).toBe(28);
  });

  it("已接 19 行分布：bank-account 1 / commission 2 / credit 5 / expense 3 / payment-config 6 / payment-new 1 / receipt 1", () => {
    const perFile = new Map<string, number>();
    for (const r of WIRED) perFile.set(r.file, (perFile.get(r.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["bank-account.routes.ts", 1],
      ["commission.routes.ts", 2],
      ["credit.routes.ts", 5],
      ["expense.routes.ts", 3],
      ["payment-config.routes.ts", 6],
      ["payment-new.routes.ts", 1],
      ["receipt.routes.ts", 1],
    ]);
  });

  it("不接 9 行分布：B 类（页面角色集不可枚举）5 / G0 锁定 3 / 公开 1", () => {
    expect(UNWIRED.filter((r) => r.kind === "B")).toHaveLength(5);
    expect(UNWIRED.filter((r) => r.kind === "G0")).toHaveLength(3);
    expect(UNWIRED.filter((r) => r.kind === "PUBLIC")).toHaveLength(1);
  });

  it("本批新增接线数与 rbac-g0-wiring.test.ts 的 S3_223_WIRED_FILES 快照一致（19）", () => {
    const g0 = readFileSync(path.join(__dirname, "rbac-g0-wiring.test.ts"), "utf8");
    expect(g0).toContain("S3_223_WIRED_FILES");
    // 合并态总数：122（G0..S3-220）+ 42（S3-222）+ 19（本批）= 183
    // S3-224（2026-10-16）同步：批 6（销售域 32 条）合入后 g0 快照的总数由 183 → 215
    //（183 + 32）⇒ 本行断言同步为 215；S3_223_WIRED_FILES 块本身**一字未动**（契约变化，非放宽断言）。
    expect(g0).toContain("S3_224_WIRED_FILES");
    expect(g0).toContain("expect(total).toBe(215)");
  });
});

describe("S3-223 · 形状断言（行级判据；踩坑[134]）", () => {
  it.each(WIRED)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")（且该行不是注释）", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).toContain(`requirePermission("${row.perm}")`);
  });

  it.each(UNWIRED)("$file $method $routePath（不接 · $kind）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });

  it("不接 3 行同时被既有锁定名单锚定（G0 范围控制 / G1 / G2 交叉印证，防口径漂移）", () => {
    const g0 = readFileSync(path.join(__dirname, "rbac-g0-wiring.test.ts"), "utf8");
    const g1 = readFileSync(path.join(__dirname, "rbac-g1-wiring.test.ts"), "utf8");
    const g2 = readFileSync(path.join(__dirname, "rbac-g2-wiring.test.ts"), "utf8");
    for (const anchor of ["/api/admin/credits", "/calculate", "payments-new"]) {
      expect(g0, `G0 范围控制名单应含 ${anchor}`).toContain(anchor);
    }
    for (const anchor of ['"/:id/close"', 'reconciliation.routes.ts']) {
      expect(g1, `G1 待裁名单应含 ${anchor}`).toContain(anchor);
      expect(g2, `G2 待裁名单应含 ${anchor}`).toContain(anchor);
    }
  });
});

describe("S3-223 · 权限持有人集合复算（生产 matchPermission × 角色实值）", () => {
  it("本批 5 个落地码的持有人集合（逐账号复算）", () => {
    // finance:create：超管/运营（*）+ 财务（finance:*）
    expect(holdersOf("finance:create")).toEqual([9002, 9006, 9010]);
    // finance:payment：上述三者 + 生产店长（**精确码**）
    expect(holdersOf("finance:payment")).toEqual([9002, 9006, 9009, 9010]);
    // finance:receipt:create：079:213 既有按钮码，财务的 finance:* 域通配命中
    expect(holdersOf("finance:receipt:create")).toEqual([9002, 9006, 9010]);
    // sale:commission：超管/运营 + 店长（sale:*）
    expect(holdersOf("sale:commission")).toEqual([9002, 9004, 9009, 9010]);
    // customer:credit：超管/运营 + 店长（customer:*）
    expect(holdersOf("customer:credit")).toEqual([9002, 9004, 9009, 9010]);
    // 反证：只读/仓管/采购/操作员/销售一律不持有本批任一码
    for (const perm of ["finance:create", "finance:payment", "finance:receipt:create", "sale:commission", "customer:credit"]) {
      for (const uid of [9001, 9003, 9005, 9007, 9008]) {
        expect(holdersOf(perm), `${perm} 不应由 uid=${uid} 持有`).not.toContain(uid);
      }
    }
  });

  it.each(WIRED)("$file $method $routePath：页面/按钮真实使用者 ⊆ 权限持有人集合（零回归判据）", (row) => {
    const holders = holdersOf(row.perm);
    expect(row.users.length, `${row.file} ${row.routePath} 必须写明使用者账号`).toBeGreaterThan(0);
    for (const uid of row.users) expect(holders, `${row.file} ${row.routePath} 使用者 ${uid}｜依据：${row.why}`).toContain(uid);
  });

  it("页面角色表与源码同源（防「测试里写一个不存在的页面角色」）：admin-web meta.roles 逐条复核", () => {
    const router = readFileSync(path.join(BACKEND_DIR, "..", "admin-web", "src", "router", "index.ts"), "utf8");
    const expectations: Array<[string, string[]]> = [
      ["bank-accounts", ["SUPER_ADMIN"]],
      ["sales/commission/rules", ["SUPER_ADMIN", "STORE_MANAGER"]],
      ["sales/commission/records", ["SUPER_ADMIN", "STORE_MANAGER"]],
      ["credit", ["SUPER_ADMIN", "STORE_MANAGER"]],
      ["finance/expenses", ["SUPER_ADMIN"]],
      ["finance/payments", ["SUPER_ADMIN"]],
      ["finance/receipts", ["SUPER_ADMIN"]],
      ["system/payment", ["SUPER_ADMIN"]],
      ["finance/reconciliation", ["SUPER_ADMIN"]],
    ];
    for (const [routePath, roles] of expectations) {
      const line = router.split(/\r?\n/).find((l) => l.includes(`path: "${routePath}"`));
      expect(line, `admin-web 路由 ${routePath} 应存在`).toBeTruthy();
      for (const role of roles) expect(line, `${routePath} 的 meta.roles 应含 ${role}`).toContain(`"${role}"`);
    }
    const menu = readFileSync(path.join(BACKEND_DIR, "..", "app-mobile", "src", "config", "function-menu.ts"), "utf8");
    for (const code of ["finance:receipt", "finance:expenses", "finance:statement"]) {
      expect(menu, `移动菜单码应含 ${code}`).toContain(`'${code}'`);
    }
  });
});

describe("S3-223 · a) 只读账号被拦（两类反证）", () => {
  it.each(WIRED)("$file $method $routePath ⇒ 403 且未到达业务层", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(WIRED)("$file $method $routePath：明确不持有该码的角色 ⇒ 403（$perm 的锁死面逐条复算）", async (row) => {
    const holders = holdersOf(row.perm);
    const nonHolders = Object.keys(USERS).map(Number).filter((uid) => !holders.includes(uid));
    expect(nonHolders.length, `${row.perm} 应存在非持有人（否则该断言无意义）`).toBeGreaterThan(0);
    for (const uid of nonHolders) {
      h.reached.length = 0;
      const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${row.file} ${row.method} ${row.routePath}／uid=${uid}（${USERS[uid].name}）`).toBe(403);
      expect(h.reached, `uid=${uid} 不得到达业务层`).toEqual([]);
    }
  });
});

describe("S3-223 · b) 有权角色照常通过（不锁死）", () => {
  const PAIRS = WIRED.flatMap((row) => row.users.map((uid) => ({ ...row, uid })));

  it.each(PAIRS)("$file $method $routePath：uid=$uid ⇒ 到达业务层（200）", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`, row.uid);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.handler).toBe("string");
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("域通配真实生效：FINANCE_STAFF 的 finance:* 通过 finance:create / finance:receipt:create 两码的行", async () => {
    const bank = await call(appFor("bank-account.routes.ts", "/api/admin/bank-accounts", bankAccountRouter), "put", "/api/admin/bank-accounts/1", FINANCE_STAFF);
    expect(bank.status).toBe(200);
    expect(bank.body.handler).toBe("updateBankAccount");

    const receipt = await call(appFor("receipt.routes.ts", "/api/admin/receipts", receiptRouter), "post", "/api/admin/receipts/RC1/void", FINANCE_STAFF);
    expect(receipt.status).toBe(200);
    expect(receipt.body.handler).toBe("voidReceipt");
  });

  it("店长（生产精确码 finance:payment）通过付款单作废行；且**不**因本批被误扩到 finance:create 面", async () => {
    const ok = await call(appFor("payment-new.routes.ts", "/api/admin/payments-new", paymentNewRouter), "post", "/api/admin/payments-new/P1/void", STORE_MANAGER_PROD);
    expect(ok.status).toBe(200);
    expect(ok.body.handler).toBe("voidPayment");

    const denied = await call(appFor("bank-account.routes.ts", "/api/admin/bank-accounts", bankAccountRouter), "put", "/api/admin/bank-accounts/1", STORE_MANAGER_PROD);
    expect(denied.status).toBe(403);
    expect(denied.body.msg).toBe("无权限执行此操作，需要权限: finance:create");
  });

  it("店长通过提成规则改/删（sale:*）与额度调整（customer:*）——页面含店长的三处逐条钉住", async () => {
    const rule = await call(appFor("commission.routes.ts", "/api/admin/commission", commissionRouter), "put", "/api/admin/commission/rules/1", STORE_MANAGER_PROD);
    expect(rule.status).toBe(200);
    const limit = await call(appFor("credit.routes.ts", "/api/admin/credits", creditRouter), "put", "/api/admin/credits/1/limit", STORE_MANAGER_PROD);
    expect(limit.status).toBe(200);
    const del = await call(appFor("commission.routes.ts", "/api/admin/commission", commissionRouter), "delete", "/api/admin/commission/rules/1", STORE_MANAGER_PROD);
    expect(del.status).toBe(200);
  });
});

describe("S3-223 · c) 未接的 9 行仍然不被拦（验收标准：证明没偷偷接）", () => {
  it.each(UNWIRED.filter((r) => r.kind !== "PUBLIC"))("$file $method $routePath（$kind）：READONLY 仍到达业务层", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`, READONLY_USER);
    expect(res.status, `${row.file} ${row.routePath}（${row.reason}）`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("公开端点（POST /api/pay/wx/callback）：无登录态、无 CSRF 仍到达业务层（保持免鉴权，未被本批误挂）", async () => {
    const res = await call(appFor("payment.routes.ts", "/api/pay", paymentRouter, true), "post", "/api/pay/wx/callback");
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe("handleWxCallback");
  });
});

describe("S3-223 · d) 未登录 401（既有行为不变）", () => {
  it.each(WIRED.filter((r) => !r.rawMount))("$file $method $routePath：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row.file, row.prefix, row.router, row.rawMount), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});
