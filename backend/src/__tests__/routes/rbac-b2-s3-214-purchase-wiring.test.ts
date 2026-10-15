/**
 * S3-214-B2 · **采购域**（9 路由文件 / 31 写端点）权限接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-214-B2.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.16（域明细）＋ §十一（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 616 条 / 151 文件）
 * 基线：`origin/main` = 本单开工时 `7beafd24`（见回执 §三）
 *
 * 本文件要证明的六件事（对应派单卡 §三.5 / §四）：
 *  a) 本批已接 **25 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 25 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「页面真实使用者持有该码」逐条钉在测试里）；
 *  d) 反证：**不持有**该码的账号一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 6 行（4 条移动端「销售开单」采购页签创建端点 + 2 条采购计划待授权）
 *     ⇒ READONLY 仍 200，且注册行级不含 `requirePermission(`（证明本批「没多接」，也没把待定项偷接）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器（只把数据库读取换成角色权限串）；
 *  · 角色权限串：仓库种子（`079_权限矩阵.sql` / `128_fix_roles_binding.sql` / `ops/S3-122*`），
 *    与 `guard-rbac-wiring.mjs --holders` 同源；生产实测持有关系由凌舟在生产只读核对（派单卡 §三）。
 *  · 页面真实使用者：`admin-web/src/router/index.ts:126-133`（桌面 `meta.roles` fail-closed）＋
 *    `app-mobile/src/config/function-menu.ts:59/60/61`（移动菜单码）+ `pages/sales/create-sale.vue:23`（采购页签无门）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）、`storageGuard`（存储配额查询）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-214/` 下反测日志与回执 §五）。
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
          // 模块命名空间会被运行期判 thenable，桩必须对 then/符号属性返回 undefined。
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
vi.mock("@controllers/admin/purchase.controller", () => h.stub());
vi.mock("@controllers/purchase-in-stock.controller", () => h.stub());
vi.mock("@controllers/purchase-payment.controller", () => h.stub());
vi.mock("@controllers/admin/purchase-plan.controller", () => h.stub());
vi.mock("@controllers/purchase-return.controller", () => h.stub());
vi.mock("@controllers/admin/purchase-contract.controller", () => h.stub());
vi.mock("@controllers/admin/supplier.controller", () => h.stub());
vi.mock("@controllers/admin/supplier-contact.controller", () => h.stub());
vi.mock("@controllers/admin/supplier-statement.controller", () => h.stub());

// 合同上传行的存储配额检查（`storage-guard` 会查 t_tenant_config / t_upload_file）⇒ 打桩放行，
// 使判据只落在「权限门禁」这一件事上。
vi.mock("@middleware/storage-guard", () => ({
  storageGuard: () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

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
import { purchaseRouter } from "../../routes/purchase.routes";
import { purchaseInStockRouter } from "../../routes/purchase-in-stock.routes";
import { purchasePaymentRouter } from "../../routes/purchase-payment.routes";
import { purchasePlanRouter } from "../../routes/purchase-plan.routes";
import { purchaseReturnRouter } from "../../routes/purchase-return.routes";
import { purchaseContractRouter } from "../../routes/purchase-contract.routes";
import { supplierRouter } from "../../routes/supplier.routes";
import { supplierContactRouter } from "../../routes/supplier-contact.routes";
import { supplierStatementRouter } from "../../routes/supplier-statement.routes";

/**
 * 测试账号：权限串取仓库角色种子（`guard-rbac-wiring.mjs` 的 ROLE_PERMISSIONS_SEED，
 * 来源 079/128/ops-S3-122*），与 `--holders` 复算口径同源。
 * 9009 = 店长（生产实测实值）、9011 = 仓管、9006 = 财务、9007 = 采购员（仓库种子）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
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
  9011: {
    name: "warehouse_staff",
    roles: ["WAREHOUSE_STAFF"],
    perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"],
  },
  9012: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  9013: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const FINANCE_STAFF = 9006;
const PURCHASE_STAFF = 9007;
const STORE_MANAGER = 9009;
const WAREHOUSE_STAFF = 9011;
const SALES_STAFF = 9012;

type Method = "post" | "put" | "delete";

interface Row {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  /** 路由文件中**注册用的路径模式**（形状断言用；与测试 URL 不同） */
  routePath: string;
  /** 测试请求 URL（把 :param 换成具体值） */
  path: string;
  /** 本行落地权限码 */
  perm: string;
  /** 该行「页面 / 入口真实使用者」的证据（零回归论证；`—` = 全仓无调用方，仅 API 策略面） */
  page: string;
}

/**
 * 本批已接名单（**25 行**，逐行判定见台账 §十一）。
 * 口径（三重，派单卡 §三）：① 优先挂「该端点真实使用者已持有的模块码」（零回归）；
 * ② 只有「采购岗专属、且使用者本来就不是店长/仓管/财务」的端点才挂 `purchase:*`（该码当前仅 SUPER_ADMIN 持有）；
 * ③ 找不到使用者已持有码 ⇒ 不接线（见 UNWIRED）。
 */
const ROWS: Row[] = [
  // ---- purchase.routes.ts（4）：采购订单页 PurchaseOrders.vue [SUPER_ADMIN]；
  //      :orderNo/approve 全仓无调用方（桌面审核按钮打的是不存在的 /confirm，见台账 §十一 卡外观察） ----
  { file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "post", routePath: "/:orderNo/approve", path: "/PO1/approve", perm: "purchase:approve", page: "无页面调用方（API 策略面）" },
  { file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "post", routePath: "/:orderNo/cancel", path: "/PO1/cancel", perm: "purchase:create", page: "PurchaseOrders.vue:328 [SUPER_ADMIN]" },
  { file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "put", routePath: "/:orderNo", path: "/PO1", perm: "purchase:create", page: "无页面调用方" },
  { file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "delete", routePath: "/:orderNo", path: "/PO1", perm: "purchase:create", page: "无页面调用方" },

  // ---- purchase-in-stock.routes.ts（2）：入库审核业务使用者 = 仓管（inventory:*） ----
  { file: "purchase-in-stock.routes.ts", prefix: "/api/admin/purchase-in-stocks", router: purchaseInStockRouter, method: "post", routePath: "/:stockNo/approve", path: "/IS1/approve", perm: "inventory:inbound", page: "入库审核（仓管业务）＋桌面页 PurchaseInStocks.vue [SUPER_ADMIN]" },
  { file: "purchase-in-stock.routes.ts", prefix: "/api/admin/purchase-in-stocks", router: purchaseInStockRouter, method: "post", routePath: "/:stockNo/void", path: "/IS1/void", perm: "inventory:inbound", page: "无页面调用方（与入库审核同族）" },

  // ---- purchase-payment.routes.ts（2）：付款审核业务使用者 = 财务（finance:*） ----
  { file: "purchase-payment.routes.ts", prefix: "/api/admin/purchase-payments", router: purchasePaymentRouter, method: "post", routePath: "/:paymentNo/approve", path: "/PAY1/approve", perm: "finance:payment", page: "PurchasePayments.vue:358（审核按钮）＋财务为业务审核人" },
  { file: "purchase-payment.routes.ts", prefix: "/api/admin/purchase-payments", router: purchasePaymentRouter, method: "post", routePath: "/:paymentNo/void", path: "/PAY1/void", perm: "finance:payment", page: "无页面调用方（与付款审核同族）" },

  // ---- purchase-return.routes.ts（2）：采购退货页 meta.roles [SUPER_ADMIN, STORE_MANAGER] ⇒ 店长必须过 ----
  { file: "purchase-return.routes.ts", prefix: "/api/admin/purchase-returns", router: purchaseReturnRouter, method: "post", routePath: "/:returnNo/approve", path: "/PR1/approve", perm: "sale:return", page: "PurchaseReturnsView.vue:138 [SUPER_ADMIN, STORE_MANAGER]" },
  { file: "purchase-return.routes.ts", prefix: "/api/admin/purchase-returns", router: purchaseReturnRouter, method: "post", routePath: "/:returnNo/void", path: "/PR1/void", perm: "sale:return", page: "无页面调用方（与退货审核同族）" },

  // ---- purchase-contract.routes.ts（4）：合同页 [SUPER_ADMIN] ----
  { file: "purchase-contract.routes.ts", prefix: "/api/admin/purchase-contracts", router: purchaseContractRouter, method: "post", routePath: "/", path: "/", perm: "purchase:create", page: "PurchaseContracts.vue:419 [SUPER_ADMIN]" },
  { file: "purchase-contract.routes.ts", prefix: "/api/admin/purchase-contracts", router: purchaseContractRouter, method: "put", routePath: "/:contractNo", path: "/CT1", perm: "purchase:create", page: "PurchaseContracts.vue:416 [SUPER_ADMIN]" },
  { file: "purchase-contract.routes.ts", prefix: "/api/admin/purchase-contracts", router: purchaseContractRouter, method: "delete", routePath: "/:contractNo", path: "/CT1", perm: "purchase:create", page: "PurchaseContracts.vue:443 [SUPER_ADMIN]" },
  { file: "purchase-contract.routes.ts", prefix: "/api/admin/purchase-contracts", router: purchaseContractRouter, method: "post", routePath: "/:contractNo/upload", path: "/CT1/upload", perm: "purchase:create", page: "无页面调用方" },

  // ---- supplier.routes.ts（4）：供应商管理页 [SUPER_ADMIN] + 移动菜单 `purchase:supplier` ----
  { file: "supplier.routes.ts", prefix: "/api/admin/suppliers", router: supplierRouter, method: "post", routePath: "/", path: "/", perm: "purchase:supplier", page: "Suppliers.vue:705 [SUPER_ADMIN]；移动 suppliers/detail.vue:535（菜单码 purchase:supplier）" },
  { file: "supplier.routes.ts", prefix: "/api/admin/suppliers", router: supplierRouter, method: "put", routePath: "/:id", path: "/1", perm: "purchase:supplier", page: "Suppliers.vue:702 [SUPER_ADMIN]；移动 suppliers/detail.vue:552,584" },
  { file: "supplier.routes.ts", prefix: "/api/admin/suppliers", router: supplierRouter, method: "post", routePath: "/:id/contacts", path: "/1/contacts", perm: "purchase:supplier", page: "无页面调用方" },
  { file: "supplier.routes.ts", prefix: "/api/admin/suppliers", router: supplierRouter, method: "delete", routePath: "/:id/contacts/:contactId", path: "/1/contacts/9", perm: "purchase:supplier", page: "无页面调用方" },

  // ---- supplier-contact.routes.ts（4）：供应商管理页联系人区 [SUPER_ADMIN]；移动端供应商管理同域 ----
  { file: "supplier-contact.routes.ts", prefix: "/api/admin/supplier-contacts", router: supplierContactRouter, method: "post", routePath: "/supplier/:supplierId", path: "/supplier/1", perm: "purchase:supplier", page: "移动「供应商管理」（菜单码 purchase:supplier）；桌面前端路径漂移见台账 §十一 卡外观察" },
  { file: "supplier-contact.routes.ts", prefix: "/api/admin/supplier-contacts", router: supplierContactRouter, method: "put", routePath: "/:id", path: "/1", perm: "purchase:supplier", page: "Suppliers.vue:652 [SUPER_ADMIN]" },
  { file: "supplier-contact.routes.ts", prefix: "/api/admin/supplier-contacts", router: supplierContactRouter, method: "delete", routePath: "/:id", path: "/1", perm: "purchase:supplier", page: "Suppliers.vue:671 [SUPER_ADMIN]" },
  { file: "supplier-contact.routes.ts", prefix: "/api/admin/supplier-contacts", router: supplierContactRouter, method: "post", routePath: "/:id/set-primary", path: "/1/set-primary", perm: "purchase:supplier", page: "Suppliers.vue:684 [SUPER_ADMIN]" },

  // ---- supplier-statement.routes.ts（3）：供应商对账页 meta.roles [SUPER_ADMIN, STORE_MANAGER]
  //      ⇒ 必须用店长持有的 report:*（店长**不持** supplier:statement，用它即 403，同批 1 的 trace:* 教训） ----
  { file: "supplier-statement.routes.ts", prefix: "/api/admin/supplier-statements", router: supplierStatementRouter, method: "post", routePath: "/generate", path: "/generate", perm: "report:finance", page: "SupplierStatements.vue:230 [SUPER_ADMIN, STORE_MANAGER]；财务亦在用" },
  { file: "supplier-statement.routes.ts", prefix: "/api/admin/supplier-statements", router: supplierStatementRouter, method: "post", routePath: "/:statementNo/confirm", path: "/SS1/confirm", perm: "report:finance", page: "SupplierStatements.vue:259 [SUPER_ADMIN, STORE_MANAGER]" },
  { file: "supplier-statement.routes.ts", prefix: "/api/admin/supplier-statements", router: supplierStatementRouter, method: "post", routePath: "/:statementNo/dispute", path: "/SS1/dispute", perm: "report:finance", page: "SupplierStatements.vue:276 [SUPER_ADMIN, STORE_MANAGER]" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /** M = 移动端「销售开单」采购页签无权限门（接线即把门店角色打成 403）；W = 待授权模型定案 */
  reason: "M" | "W";
  note: string;
}

/** 本域**本批未接**的 6 行（逐条原因见台账 §十一）。 */
const UNWIRED: UnwiredRow[] = [
  { file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "post", routePath: "/", path: "/", reason: "M", note: "移动 create-sale.vue:2159（doc=pur_order）；页签无权限门 app-mobile/src/pages/sales/create-sale.vue:23" },
  { file: "purchase-in-stock.routes.ts", prefix: "/api/admin/purchase-in-stocks", router: purchaseInStockRouter, method: "post", routePath: "/", path: "/", reason: "M", note: "移动 create-sale.vue:2112（doc=pur_inbound）；同上页签无门" },
  { file: "purchase-payment.routes.ts", prefix: "/api/admin/purchase-payments", router: purchasePaymentRouter, method: "post", routePath: "/", path: "/", reason: "M", note: "移动 create-sale.vue:2211（doc=pur_payment）；同上页签无门" },
  { file: "purchase-return.routes.ts", prefix: "/api/admin/purchase-returns", router: purchaseReturnRouter, method: "post", routePath: "/", path: "/", reason: "M", note: "移动 create-sale.vue:2270（submitPurchaseReturn）；同上页签无门" },
  { file: "purchase-plan.routes.ts", prefix: "/api/admin/purchase-plans", router: purchasePlanRouter, method: "post", routePath: "/", path: "/", reason: "W", note: "页面 meta.roles 含 STORE_MANAGER（router/index.ts:131），生产店长不持任何 purchase:*，且无店长已持有的采购计划语义码" },
  { file: "purchase-plan.routes.ts", prefix: "/api/admin/purchase-plans", router: purchasePlanRouter, method: "post", routePath: "/:planNo/convert", path: "/PL1/convert", reason: "W", note: "同上一行（采购计划页 PurchasePlans.vue:336）" },
];

/** 台账 §三.16 的本域写端点总数（9 文件） = 本批已接 25 + 未接 6 */
const DOMAIN_TOTAL = 31;

function label(row: { file: string; method: Method; routePath: string }) {
  return `${row.file} ${row.method.toUpperCase()} ${row.routePath}`;
}

/** 复算「该权限码在本测试账号集里有谁持有」（生产同一份 matchPermission） */
function holdersOf(perm: string): number[] {
  return Object.keys(USERS)
    .map(Number)
    .filter((uid) => matchPermission(USERS[uid].perms, perm))
    .sort((a, b) => a - b);
}

/** 非持有人（用于反证 403） */
function nonHoldersOf(perm: string): number[] {
  const holders = new Set(holdersOf(perm));
  return Object.keys(USERS)
    .map(Number)
    .filter((uid) => !holders.has(uid))
    .sort((a, b) => a - b);
}

function buildApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
      // 与 middleware/auth.ts requireAuth 的 401 口径一致
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

function call(app: express.Express, method: Method, url: string, uid?: number) {
  const req = request(app)[method](url);
  if (uid) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(row: { file: string; prefix: string; router: Router }) {
  const key = `${row.file}|${row.prefix}`;
  if (!APPS.has(key)) APPS.set(key, buildApp(row.prefix, row.router));
  return APPS.get(key)!;
}

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));

/** 取某文件里「注册某方法＋某路径模式」的**行**（跳过注释行）——踩坑[134]：判据必须落到注册行 */
function registrationLines(file: string, method: Method, routePath: string): { line: string; no: number }[] {
  const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${method}\\(\\s*"${escaped}"`);
  return src
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && re.test(line));
}

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

describe("S3-214-B2 · 名单自证", () => {
  it("25 已接 + 6 未接 = 31（= 台账 §三.16 本域写端点总数）", () => {
    expect(ROWS).toHaveLength(25);
    expect(UNWIRED).toHaveLength(6);
    expect(ROWS.length + UNWIRED.length).toBe(DOMAIN_TOTAL);
  });

  it("已接 25 行的逐文件分布（与台账 §十一 表一致）", () => {
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["purchase-contract.routes.ts", 4],
      ["purchase-in-stock.routes.ts", 2],
      ["purchase-payment.routes.ts", 2],
      ["purchase-return.routes.ts", 2],
      ["purchase.routes.ts", 4],
      ["supplier-contact.routes.ts", 4],
      ["supplier-statement.routes.ts", 3],
      ["supplier.routes.ts", 4],
    ]);
    // 9 个路由文件里 purchase-plan.routes.ts 是**唯一**本批 0 接线的（2 条待授权），需在断言里显式钉住
    expect(perFile.has("purchase-plan.routes.ts")).toBe(false);
  });

  it("已接 25 行只用 7 个**既有**权限码（本批不新立权限点、不改角色种子）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual([
      "finance:payment",
      "inventory:inbound",
      "purchase:approve",
      "purchase:create",
      "purchase:supplier",
      "report:finance",
      "sale:return",
    ]);
  });
});

describe("S3-214-B2 · 形状断言（注册行级判据，踩坑[134]）", () => {
  it.each(ROWS)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).toContain(`requirePermission("${row.perm}")`);
  });

  it.each(UNWIRED)("$file $method $routePath（未接，原因 $reason）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.map((l) => l.no)).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
  });

  it("整文件子串不足以判定（踩坑[134]）：purchase-in-stock.routes.ts 文件级已含 requirePermission，但被排除的创建行没有", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "purchase-in-stock.routes.ts"), "utf8");
    expect(src).toContain('requirePermission("inventory:inbound")');
    const lines = registrationLines("purchase-in-stock.routes.ts", "post", "/");
    expect(lines).toHaveLength(1);
    expect(lines[0].line, "移动端页签用的创建行不得被误判为已接线").not.toContain("requirePermission(");
  });
});

describe("S3-214-B2 · 权限持有人集合复算（生产 matchPermission × 仓库角色种子）", () => {
  it("7 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    // purchase:* 只有采购员（种子）与两个 `*` 角色；店长/仓管/财务/收银员/销售均不持 ⇒ 这就是 4 个风险组合的根因
    expect(holdersOf("purchase:create")).toEqual([SUPER_ADMIN, PURCHASE_STAFF, 9010]);
    expect(holdersOf("purchase:approve")).toEqual([SUPER_ADMIN, PURCHASE_STAFF, 9010]);
    expect(holdersOf("purchase:supplier")).toEqual([SUPER_ADMIN, PURCHASE_STAFF, 9010]);
    // 入库审核：仓管（inventory:*）+ 店长（inventory:*）+ 采购员（精确 inventory:inbound）
    expect(holdersOf("inventory:inbound")).toEqual([SUPER_ADMIN, PURCHASE_STAFF, STORE_MANAGER, 9010, WAREHOUSE_STAFF]);
    // 付款审核：财务（finance:*）+ 店长（精确 finance:payment）
    expect(holdersOf("finance:payment")).toEqual([SUPER_ADMIN, FINANCE_STAFF, STORE_MANAGER, 9010]);
    // 采购退货：店长（sale:*）+ 门店运营员（精确 sale:return）
    expect(holdersOf("sale:return")).toEqual([SUPER_ADMIN, STORE_MANAGER, 9010, 9013]);
    // 供应商对账：店长/财务均经 report:* 命中；采购员的 report:purchase **不**覆盖 report:finance
    expect(holdersOf("report:finance")).toEqual([SUPER_ADMIN, FINANCE_STAFF, STORE_MANAGER, 9010]);
  });

  it("反证：READONLY 对 7 个码全不持有（`*:view` 不覆盖任何写动作码）", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      expect(matchPermission(USERS[READONLY].perms, perm), `READONLY 不得持有 ${perm}`).toBe(false);
    }
  });

  it("零回归的根因证明：店长**不持** purchase:*，因此采购单/合同/供应商 12 行只能给超管（页面亦然）", () => {
    for (const perm of ["purchase:create", "purchase:approve", "purchase:supplier"]) {
      expect(matchPermission(USERS[STORE_MANAGER].perms, perm), `店长不得持有 ${perm}`).toBe(false);
    }
    // 而店长**确实在用**的三类页面（采购退货 / 供应商对账 / 入库审核）用的码，店长必须持有
    for (const perm of ["sale:return", "report:finance", "inventory:inbound"]) {
      expect(matchPermission(USERS[STORE_MANAGER].perms, perm), `店长应持有 ${perm}`).toBe(true);
    }
  });

  it("判据有分辨力：财务的 finance:* 不覆盖 purchase:*，仓管的 inventory:* 不覆盖 purchase:*", () => {
    expect(matchPermission(USERS[FINANCE_STAFF].perms, "finance:payment")).toBe(true);
    expect(matchPermission(USERS[FINANCE_STAFF].perms, "purchase:payment")).toBe(false);
    expect(matchPermission(USERS[WAREHOUSE_STAFF].perms, "inventory:inbound")).toBe(true);
    expect(matchPermission(USERS[WAREHOUSE_STAFF].perms, "purchase:approve")).toBe(false);
  });

  it("`supplier:statement` 的持有人里**没有**店长 ⇒ 对账页若挂它必 403（本批改用 report:finance 的理由）", () => {
    expect(holdersOf("supplier:statement")).toEqual([SUPER_ADMIN, FINANCE_STAFF, PURCHASE_STAFF, 9010]);
    expect(holdersOf("supplier:statement")).not.toContain(STORE_MANAGER);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "supplier:statement")).toBe(false);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "report:finance")).toBe(true);
  });
});

describe("S3-214-B2 · 两侧判据 a) 缺码 ⇒ 403 且未到达业务层", () => {
  it.each(ROWS)("$file $method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$file $method $routePath：全部非持有人（逐账号枚举）⇒ 403", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name} 不应通过 ${label(row)}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("S3-214-B2 · 两侧判据 b) 有码 ⇒ 通过（不锁死既有页面角色）", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name} 应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it("店长（生产实值）通过 9 行 —— 其中 5 行是「页面 meta.roles 含 STORE_MANAGER」的真实使用行（零回归正面证据）", async () => {
    // 店长（生产实值：store:*/sale:*/inventory:*/report:*/finance:payment…）在本批 25 行上命中 9 行：
    // 入库 2（inventory:*）+ 付款 2（精确 finance:payment）+ 采购退货 2（sale:*）+ 供应商对账 3（report:*）。
    // 前两类是「持有 ⊋ 页面」的宽授（页面不可达，不构成回归）；后两类是页面真实使用行，**必须**过。
    const storeManagerRows = ROWS.filter((row) => holdersOf(row.perm).includes(STORE_MANAGER));
    const expected = [
      "purchase-in-stock.routes.ts POST /:stockNo/approve",
      "purchase-in-stock.routes.ts POST /:stockNo/void",
      "purchase-payment.routes.ts POST /:paymentNo/approve",
      "purchase-payment.routes.ts POST /:paymentNo/void",
      "purchase-return.routes.ts POST /:returnNo/approve",
      "purchase-return.routes.ts POST /:returnNo/void",
      "supplier-statement.routes.ts POST /:statementNo/confirm",
      "supplier-statement.routes.ts POST /:statementNo/dispute",
      "supplier-statement.routes.ts POST /generate",
    ].sort();
    expect(storeManagerRows.map((r) => `${r.file} ${r.method.toUpperCase()} ${r.routePath}`).sort()).toEqual(expected);
    // 页面真实使用行（`PurchaseReturnsView.vue:138` / `SupplierStatements.vue:230/259/276`，meta.roles 含 STORE_MANAGER）⊆ 上述 9 行
    const pageRows = storeManagerRows
      .filter((r) => r.file === "purchase-return.routes.ts" || r.file === "supplier-statement.routes.ts")
      .map((r) => `${r.file} ${r.method.toUpperCase()} ${r.routePath}`);
    expect(pageRows).toHaveLength(5);
    for (const row of storeManagerRows) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, STORE_MANAGER);
      expect(res.status, `店长应通过 ${label(row)}（页面真实使用者，不得被本批打成 403）`).toBe(200);
    }
  });

  it("财务通过「付款审核 / 付款作废 / 对账 3 行」共 5 行 —— 职责归属正面证据", async () => {
    const rows = ROWS.filter((row) => holdersOf(row.perm).includes(FINANCE_STAFF));
    expect(rows.map((r) => `${r.file} ${r.method.toUpperCase()} ${r.routePath}`).sort()).toEqual([
      "purchase-payment.routes.ts POST /:paymentNo/approve",
      "purchase-payment.routes.ts POST /:paymentNo/void",
      "supplier-statement.routes.ts POST /:statementNo/confirm",
      "supplier-statement.routes.ts POST /:statementNo/dispute",
      "supplier-statement.routes.ts POST /generate",
    ]);
    for (const row of rows) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, FINANCE_STAFF);
      expect(res.status, `财务应通过 ${label(row)}`).toBe(200);
    }
  });

  it("仓管通过入库审核 2 行、采购员通过 18 行、超管/运营员通过全部 25 行", async () => {
    const whRows = ROWS.filter((row) => holdersOf(row.perm).includes(WAREHOUSE_STAFF));
    expect(whRows).toHaveLength(2);
    for (const row of whRows) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, WAREHOUSE_STAFF);
      expect(res.status, `仓管应通过 ${label(row)}`).toBe(200);
    }

    const psRows = ROWS.filter((row) => holdersOf(row.perm).includes(PURCHASE_STAFF));
    // 采购员（purchase:* / supplier:* / 精确 inventory:inbound）= 1（审核）+ 7（purchase:create）+ 8（purchase:supplier）+ 2（inventory:inbound）
    expect(psRows).toHaveLength(18);
    for (const row of psRows) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, PURCHASE_STAFF);
      expect(res.status, `采购员应通过 ${label(row)}`).toBe(200);
    }

    for (const uid of [SUPER_ADMIN, 9010]) {
      for (const row of ROWS) {
        const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
        expect(res.status, `${USERS[uid].name} 应通过 ${label(row)}`).toBe(200);
      }
    }
  });
});

describe("S3-214-B2 · 两侧判据 c) 收银/销售类角色（页面外）仍被拦住 —— 不是「谁都能过」", () => {
  it("SALES_STAFF 对全部 25 行 ⇒ 403（本批没有把权限门放宽成摆设）", async () => {
    expect(matchPermission(USERS[SALES_STAFF].perms, "sale:create")).toBe(true);
    for (const row of ROWS) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, SALES_STAFF);
      expect(res.status, `销售员不应通过 ${label(row)}`).toBe(403);
    }
  });

  it("STORE_OPERATOR（持 sale:return）只通过退货 2 行，对其余 23 行 403", async () => {
    const passing = ROWS.filter((row) => holdersOf(row.perm).includes(9013));
    expect(passing.map((r) => `${r.file} ${r.routePath}`)).toEqual([
      "purchase-return.routes.ts /:returnNo/approve",
      "purchase-return.routes.ts /:returnNo/void",
    ]);
    for (const row of ROWS) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, 9013);
      expect(res.status, `${label(row)} 的期望结论与 holdersOf 复算不一致`).toBe(
        holdersOf(row.perm).includes(9013) ? 200 : 403
      );
    }
  });
});

describe("S3-214-B2 · 范围控制 d) 本域未接的 6 行不被本批拦住（且不得偷接）", () => {
  it("未接 6 行的原因分布：M（移动端页签无权限门）4 条 / W（待授权模型定案）2 条", () => {
    const byReason = new Map<string, number>();
    for (const row of UNWIRED) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    expect([...byReason.entries()].sort()).toEqual([
      ["M", 4],
      ["W", 2],
    ]);
  });

  it.each(UNWIRED)("$file $method $routePath：READONLY ⇒ 200（未被本批拦住，保持原状态）", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("采购计划 2 条仍在台账与门禁缺口里（未被静默洗绿）", () => {
    const baseline = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../scripts/rbac-wiring-baseline.json", import.meta.url)), "utf8")
    );
    expect(baseline.gaps["purchase-plan.routes.ts"]).toEqual([
      "POST /api/admin/purchase-plans/",
      "POST /api/admin/purchase-plans/:planNo/convert",
    ]);
    // 4 条移动端创建行同样保留在缺口台账里（key = 文件，值含该端点）
    for (const [file, endpoint] of [
      ["purchase.routes.ts", "POST /api/admin/purchase-orders/"],
      ["purchase-in-stock.routes.ts", "POST /api/admin/purchase-in-stocks/"],
      ["purchase-payment.routes.ts", "POST /api/admin/purchase-payments/"],
      ["purchase-return.routes.ts", "POST /api/admin/purchase-returns/"],
    ]) {
      expect(baseline.gaps[file], `${file} 应保留该缺口`).toContain(endpoint);
    }
    // 已接线的 3 个文件不再出现在缺口台账里（已接线端点不入台账）
    for (const file of ["supplier.routes.ts", "supplier-contact.routes.ts", "supplier-statement.routes.ts", "purchase-contract.routes.ts"]) {
      expect(baseline.gaps[file], `${file} 已清零，不应留在缺口台账`).toBeUndefined();
    }
  });
});

describe("S3-214-B2 · e) 未登录 401（既有行为不变）", () => {
  it.each(ROWS)("$file $method $routePath：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(h.reached).toEqual([]);
  });
});
