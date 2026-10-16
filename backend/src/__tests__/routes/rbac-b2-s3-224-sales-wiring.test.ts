/**
 * S3-224 · **销售域**（17 路由文件 / 100 写端点里的 87 条仍缺口 → 本批接 32 条）权限接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-224.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.5（域明细）＋ §十四（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` 499 条 / 131 文件）
 * 判定留档：`docs/evidence/S3-224/01-plan-and-judgements.md`
 *
 * 本文件要证明的六件事（对应派单卡 §三.1/§三.2/§三.5）：
 *  a) 本批已接 **32 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 32 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「页面/按钮真实使用者持有该码」逐条钉进测试）；
 *  d) 反证：**不持有**该码的账号一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 9 行（覆盖 B/L/Q/P/C/W-M 六类原因）⇒ 注册行级不含
 *     `requirePermission(`，且 READONLY 仍能到达业务层（证明本批「没多接」，也没把待定项偷接）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 角色权限串：**生产只读实值**（凌舟 2026-10-16 导出，12 角色 / 租户 `default`，
 *    原始输出 `docs/evidence/S3-220/00-prod-roles-raw.txt`，复算 `05-prod-holders.txt`）
 *    ＋ 仓库种子（`079_权限矩阵.sql` / `099_seed_data.sql` 旧词表口径）；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）＋
 *    `app-mobile/src/config/function-menu.ts` 的移动菜单码与首页快捷入口（`pages/home/home.vue:69/75`）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）、
 *        `instant-retail-store.routes.ts` 的**内联** `requireStoreAuth`（真实 JWT 链）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试多数行用请求头注入；门店端那 4 行用真 JWT）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-224/20-neg-*.txt` 与回执 §五）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Router, Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCsrfToken } from "../../middleware/csrf";
import { signToken } from "../../middleware/auth";
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
vi.mock("@controllers/admin/marketing-flash-sale.controller", () => h.stub());
vi.mock("@controllers/admin/order.controller", () => h.stub());
vi.mock("@controllers/admin/quote-push.controller", () => h.stub());
vi.mock("@controllers/admin/aftersale.controller", () => h.stub());
vi.mock("@controllers/admin/commerce-fix.controller", () => h.stub());
vi.mock("@controllers/order-timeout.controller", () => h.stub());
vi.mock("@controllers/admin/sale-return.controller", () => h.stub());
vi.mock("@controllers/store/order.controller", () => h.stub());
vi.mock("@controllers/store/other.controller", () => h.stub());
vi.mock("@controllers/store/sale-bill.controller", () => h.stub());
vi.mock("@controllers/store/shift.controller", () => h.stub());
vi.mock("@controllers/instant-retail/order-receiving.controller", () => h.stub());
vi.mock("@controllers/instant-retail/fulfillment.controller", () => h.stub());
vi.mock("@controllers/admin/position.controller", () => h.stub());
vi.mock("@controllers/admin/order-exception.controller", () => h.stub());
vi.mock("@controllers/admin/cart.controller", () => h.stub());
vi.mock("@controllers/admin/instant-retail.controller", () => h.stub());
vi.mock("@controllers/admin/instant-retail-ext.controller", () => h.stub());
vi.mock("@controllers/instant-retail/review.controller", () => h.stub());
vi.mock("@controllers/instant-retail/reconciliation.controller", () => h.stub());
vi.mock("@controllers/instant-retail/analytics.controller", () => h.stub());
vi.mock("@controllers/admin/instant-retail-fix.controller", () => h.stub());
vi.mock("@controllers/instant-retail/platform-integration.controller", () => h.stub());

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
import { adminMarketingFlashSaleRouter } from "../../routes/admin-marketing-flash-sale.routes";
import { adminOrderRouter } from "../../routes/admin-order.routes";
import { adminQuotePushRouter } from "../../routes/admin-quote-push.routes";
import { adminAftersaleRouter } from "../../routes/aftersale.routes";
import { storeOrderRouter, storeHoldOrderRouter } from "../../routes/store-order.routes";
import { storeSaleBillRouter } from "../../routes/store-sale-bill.routes";
import { storeShiftRouter, storeShiftsRouter } from "../../routes/store-shift.routes";
import { saleReturnRouter } from "../../routes/sale-return.routes";
import { adminCommerceFixRouter } from "../../routes/commerce-fix.routes";
import { orderTimeoutRouter } from "../../routes/order-timeout.routes";
import { instantRetailStoreRouter } from "../../routes/instant-retail-store.routes";
import { miniappCartRouter } from "../../routes/cart.routes";
import { instantRetailWebhookRouter } from "../../routes/instant-retail-webhook.routes";
import { positionRouter } from "../../routes/position.routes";
import { orderExceptionRouter } from "../../routes/order-exception.routes";
import { instantRetailAdminOpsRouter } from "../../routes/instant-retail-admin-ops.routes";

/**
 * 测试账号：权限串 = **生产只读实值**（9009 店长 / 9013 门店操作员 / 9006 财务，凌舟 2026-10-16 导出）
 * ＋ 仓库种子（9001 只读 / 9002 超管 / 9010 运营 / 9012 销售员 / 9014 客服 / 9015 STORE_ADMIN 旧词表）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; storeId?: number }> = {
  // ⚠️ 每个账号都带 `storeId`：门店端 4 行经 `requireStoreAuth`（`middleware/store-auth.ts:6-12`）的
  //    「无 storeId ⇒ 403 无门店权限」判定，缺 storeId 会先被拦在那里、掩盖 requirePermission 的结果。
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], storeId: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], storeId: 1 },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
    storeId: 1,
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
    storeId: 1,
  },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], storeId: 1 },
  9012: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
    storeId: 1,
  },
  9013: {
    name: "store_operator_prod",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
    storeId: 1,
  },
  9014: {
    name: "customer_service",
    roles: ["CUSTOMER_SERVICE"],
    perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"],
    storeId: 1,
  },
  9015: {
    name: "store_admin_legacy",
    roles: ["STORE_ADMIN"],
    perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"],
    storeId: 1,
  },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const FINANCE_STAFF = 9006;
const STORE_MANAGER = 9009;
const OPERATION_ADMIN = 9010;
const SALES_STAFF = 9012;
const STORE_OPERATOR = 9013;
const CUSTOMER_SERVICE = 9014;
const STORE_ADMIN_LEGACY = 9015;

/** 页面角色名 → 测试账号（用于「页面角色 ⊆ 码持有人」的机器复算） */
const PAGE_ROLE_USER: Record<string, number> = {
  SUPER_ADMIN,
  OPERATION_ADMIN,
  STORE_MANAGER,
  STORE_OPERATOR,
  SALES_STAFF,
  FINANCE_STAFF,
};

type Method = "post" | "put" | "delete";

interface Row {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  /** 路由文件中**注册用的路径模式**（形状断言用；与测试 URL 不同） */
  routePath: string;
  /** 测试请求 URL 的路径部分（把 :param 换成具体值） */
  path: string;
  /** 本行落地权限码 */
  perm: string;
  /** 真实使用者（admin-web 页面角色；`[]` = 全仓无页面调用方，仅 API 策略面） */
  pageRoles: string[];
  /** 真实使用者依据（文件:行） */
  page: string;
  /** true = 需要真 JWT 挂载（`instant-retail-store.routes.ts` 内联 requireStoreAuth） */
  rawMount?: boolean;
}

/**
 * 已接名单（**36 行** = S3-224 的 32 行 + S3-233 收编的 4 行，逐行判定见
 * `docs/evidence/S3-224/01-plan-and-judgements.md` 与 `docs/tasks/R101-RBAC接线缺口清单.md` §十八）。
 * 口径（派单卡 §二）：① 优先挂「该端点**真实使用者已持有**的模块码」（零回归）；
 * ② 使用者集合不可枚举 / 命中既有锁定 / 查询型 POST / 公开 / 待裁定 ⇒ 不接线（见 UNWIRED）；
 * ③ 本批**不新立权限码、不改角色种子、不动迁移**。
 */
const ROWS: Row[] = [
  // ---- admin-marketing-flash-sale.routes.ts（2）----
  { file: "admin-marketing-flash-sale.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFlashSaleRouter, method: "put", routePath: "/flash-sales/:id", path: "/flash-sales/1", perm: "sale:edit", pageRoles: ["SUPER_ADMIN"], page: "FlashSale.vue:387（秒杀活动 marketing/flash-sale，router:228）" },
  { file: "admin-marketing-flash-sale.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFlashSaleRouter, method: "delete", routePath: "/flash-sales/:id", path: "/flash-sales/1", perm: "sale:edit", pageRoles: ["SUPER_ADMIN"], page: "FlashSale.vue:418 + MarketingView.vue:542（营销活动 router:220）" },

  // ---- admin-order.routes.ts（3）----
  { file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "post", routePath: "/orders/batch-status", path: "/orders/batch-status", perm: "sale:edit", pageRoles: [], page: "全仓无页面调用点（api 封装亦无）" },
  { file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "post", routePath: "/orders/:orderNo/cancel", path: "/orders/O1/cancel", perm: "sale:void", pageRoles: [], page: "无页面调用点（app-mobile orders.ts:117 仅封装，无页面使用）" },
  { file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "put", routePath: "/orders/:orderNo/remark", path: "/orders/O1/remark", perm: "sale:edit", pageRoles: [], page: "全仓无页面调用点" },

  // ---- admin-quote-push.routes.ts（2 / 4）----
  { file: "admin-quote-push.routes.ts", prefix: "/api/admin/quote-push", router: adminQuotePushRouter, method: "post", routePath: "/:id/push", path: "/9/push", perm: "sale:create", pageRoles: [], page: "全仓无页面调用点（admin-web `rg quote-push` 零命中；app-mobile 仅孤岛页，且打的是 `POST /` 不是本行）" },
  { file: "admin-quote-push.routes.ts", prefix: "/api/admin/quote-push", router: adminQuotePushRouter, method: "post", routePath: "/:id/cancel", path: "/9/cancel", perm: "sale:void", pageRoles: [], page: "全仓无页面调用点" },

  // ---- aftersale.routes.ts（1 / 5）----
  { file: "aftersale.routes.ts", prefix: "/api/admin", router: adminAftersaleRouter, method: "post", routePath: "/aftersales/:id/confirm-receipt", path: "/aftersales/1/confirm-receipt", perm: "sale:return", pageRoles: ["SUPER_ADMIN"], page: "AftersaleView.vue:307（售后管理 marketing/aftersale，router:230）" },

  // ---- commerce-fix.routes.ts（4）----
  { file: "commerce-fix.routes.ts", prefix: "/api/admin", router: adminCommerceFixRouter, method: "delete", routePath: "/consumer-addresses/:id", path: "/consumer-addresses/1", perm: "sale:edit", pageRoles: [], page: "无页面调用点（admin-web customer.ts:380/384 只有 GET）" },
  { file: "commerce-fix.routes.ts", prefix: "/api/admin", router: adminCommerceFixRouter, method: "put", routePath: "/bills/:id", path: "/bills/1", perm: "sale:edit", pageRoles: ["SUPER_ADMIN"], page: "BillManagement.vue:304（票据管理 bill-management，router:205）" },
  { file: "commerce-fix.routes.ts", prefix: "/api/admin", router: adminCommerceFixRouter, method: "delete", routePath: "/bills/:id", path: "/bills/1", perm: "sale:edit", pageRoles: [], page: "无页面调用点（admin-web finance.ts 无 deleteBill）" },
  { file: "commerce-fix.routes.ts", prefix: "/api/admin", router: adminCommerceFixRouter, method: "post", routePath: "/bills/:id/void", path: "/bills/1/void", perm: "sale:void", pageRoles: ["SUPER_ADMIN"], page: "BillManagement.vue:281" },

  // ---- order-timeout.routes.ts（3）----
  { file: "order-timeout.routes.ts", prefix: "/api/admin/order-timeout", router: orderTimeoutRouter, method: "post", routePath: "/configs", path: "/configs", perm: "sale:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "OrderTimeoutView.vue:327（订单超时 order-timeout，router:118）" },
  { file: "order-timeout.routes.ts", prefix: "/api/admin/order-timeout", router: orderTimeoutRouter, method: "put", routePath: "/configs/:id", path: "/configs/1", perm: "sale:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "OrderTimeoutView.vue:292/324" },
  { file: "order-timeout.routes.ts", prefix: "/api/admin/order-timeout", router: orderTimeoutRouter, method: "delete", routePath: "/configs/:id", path: "/configs/1", perm: "sale:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "OrderTimeoutView.vue:309" },

  // ---- sale-return.routes.ts（2 / 3；`POST /` 见 UNWIRED 的 L 类）----
  { file: "sale-return.routes.ts", prefix: "/api/admin/sale-returns", router: saleReturnRouter, method: "post", routePath: "/:returnNo/approve", path: "/SR1/approve", perm: "sale:return", pageRoles: [], page: "无页面调用点（app-mobile store.ts:829/834 仅封装、无页面使用）" },
  { file: "sale-return.routes.ts", prefix: "/api/admin/sale-returns", router: saleReturnRouter, method: "post", routePath: "/:returnNo/reject", path: "/SR1/reject", perm: "sale:return", pageRoles: [], page: "同上一行" },

  // ---- store-order.routes.ts（8 / 8；S3-233 收编 `POST /:orderNo/start-delivery` 与 `POST /hold-orders/`）----
  { file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/accept", path: "/O1/accept", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/OrderFulfillView.vue:150（接单履约 pos/order-fulfill，router:262）" },
  { file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/complete-delivery", path: "/O1/complete-delivery", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/OrderFulfillView.vue:176" },
  { file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/reject", path: "/O1/reject", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/OrderFulfillView.vue:163" },
  { file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/cancel", path: "/O1/cancel", perm: "sale:void", pageRoles: [], page: "全仓无页面调用点（取消/作废属高风险动作，不扩给收银员）" },
  { file: "store-order.routes.ts", prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, method: "post", routePath: "/:holdNo/restore", path: "/H1/restore", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/HoldOrderView.vue:83 + pos/CashierView.vue:1689（挂单管理 router:265 / 快速收银 :259）" },
  { file: "store-order.routes.ts", prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, method: "delete", routePath: "/:holdNo", path: "/H1", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/HoldOrderView.vue:96 + pos/CashierView.vue:1709" },

  // ---- store-sale-bill.routes.ts（1 / 4；payment 见 UNWIRED 的 L 类，另 2 条见 B 类）----
  { file: "store-sale-bill.routes.ts", prefix: "/api/store/sale-bills", router: storeSaleBillRouter, method: "post", routePath: "/:billNo/pay-by-code", path: "/B1/pay-by-code", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/CashierView.vue:1628（快速收银 pos/cashier，router:259）" },

  // ---- store-shift.routes.ts（4）----
  { file: "store-shift.routes.ts", prefix: "/api/store/shift", router: storeShiftRouter, method: "post", routePath: "/settle", path: "/settle", perm: "finance:daily-settle", pageRoles: [], page: "全仓无页面调用点（班结；与 pos/daily-settle 同族码）" },
  { file: "store-shift.routes.ts", prefix: "/api/store/shifts", router: storeShiftsRouter, method: "post", routePath: "/", path: "/", perm: "finance:daily-settle", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/ShiftView.vue:258（交接班 pos/shift，router:268）" },
  { file: "store-shift.routes.ts", prefix: "/api/store/shifts", router: storeShiftsRouter, method: "post", routePath: "/:shiftNo/check", path: "/JB1/check", perm: "finance:daily-settle", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/ShiftDetailView.vue:345（交接班详情 router:269）" },
  { file: "store-shift.routes.ts", prefix: "/api/store/shifts", router: storeShiftsRouter, method: "post", routePath: "/:shiftNo/close", path: "/JB1/close", perm: "finance:daily-settle", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pos/ShiftView.vue:296" },

  // ---- instant-retail-store.routes.ts（4；内联 requireStoreAuth ⇒ rawMount）----
  { file: "instant-retail-store.routes.ts", prefix: "/api/store/instant-retail", router: instantRetailStoreRouter, method: "post", routePath: "/orders/:platformOrderId/confirm", path: "/orders/PLAT1/confirm", perm: "sale:create", pageRoles: [], page: "全仓无页面调用点（`rg '/store/instant-retail'` 四个前端零命中）", rawMount: true },
  { file: "instant-retail-store.routes.ts", prefix: "/api/store/instant-retail", router: instantRetailStoreRouter, method: "post", routePath: "/orders/:platformOrderId/cancel", path: "/orders/PLAT1/cancel", perm: "sale:void", pageRoles: [], page: "全仓无页面调用点", rawMount: true },
  { file: "instant-retail-store.routes.ts", prefix: "/api/store/instant-retail", router: instantRetailStoreRouter, method: "post", routePath: "/orders/:platformOrderId/start-delivery", path: "/orders/PLAT1/start-delivery", perm: "sale:create", pageRoles: [], page: "全仓无页面调用点", rawMount: true },
  { file: "instant-retail-store.routes.ts", prefix: "/api/store/instant-retail", router: instantRetailStoreRouter, method: "post", routePath: "/orders/:platformOrderId/complete-delivery", path: "/orders/PLAT1/complete-delivery", perm: "sale:create", pageRoles: [], page: "全仓无页面调用点", rawMount: true },

  // ===== S3-233（B 类收编第一批 · 销售域 4 条）=================================================
  // 依据门（唯一真相源）= app-mobile/src/config/permission-gates.ts：`sale-order-detail-deliver`、
  //   `sale-create-hold`、`sale-bill-offline-pay`，门码均为 `sale:create`（履约/挂单/收款同族，与本表 :270-275/:278 先例同码）。
  // B 类前提（订单详情页 / 开单页 / 销售单详情页经首页快捷入口或推送深链无条件可达 ⇒ 使用者集合不可枚举）
  // 已由 S3-230 的入口权限门修复（D4/I1'）⇒ 本批收编；不新立码、不改角色种子、不动迁移。
  { file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "put", routePath: "/orders/:orderNo/status", path: "/orders/O1/status", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "app-mobile pages/orders/order-detail.vue:258 状态流转（门 sale-order-detail-deliver）；同族码先例见本表 :270-273" },
  { file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/start-delivery", path: "/O1/start-delivery", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "app-mobile pages/orders/order-detail.vue:258（门 sale-order-detail-deliver）；与同文件 accept/complete-delivery 同族（:270-272）" },
  { file: "store-order.routes.ts", prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, method: "post", routePath: "/", path: "/", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "app-mobile pages/sales/create-sale.vue:2013（挂单，门 sale-create-hold）+ admin-web views/sale/SalesOrderCreate.vue:531（同一接口的注释）" },
  { file: "store-sale-bill.routes.ts", prefix: "/api/store/sale-bills", router: storeSaleBillRouter, method: "post", routePath: "/:billNo/offline-payment", path: "/B1/offline-payment", perm: "sale:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], page: "pages-sub/order/sales/sale-detail.vue:177（线下收款，门 sale-bill-offline-pay）；同族先例 = 本表 :278 的 pay-by-code" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /** B = app-mobile 使用者集合不可枚举；L = 既有锁定；Q = 查询型 POST；P = 公开端点；C = 消费者端形态；W = 待授权模型定案 */
  reason: "B" | "L" | "Q" | "P" | "C" | "W";
  note: string;
  rawMount?: boolean;
}

/** 本域本批**未接**的代表行（六类原因各取样；逐条全量见台账 §十四.5~§十四.7）。 */
const UNWIRED: UnwiredRow[] = [
  // （S3-233：原两行 B 类（status / hold-orders）已收编接线，见上方 ROWS 的 S3-233 块与缺口清单 §十八）
  { file: "store-sale-bill.routes.ts", prefix: "/api/store/sale-bills", router: storeSaleBillRouter, method: "post", routePath: "/:billNo/payment", path: "/B1/payment", reason: "L", note: "`rbac-g0-wiring.test.ts:730` 的 `NOT_IN_G0` 断言 READONLY 仍 200（注释标「归 G2」）" },
  { file: "sale-return.routes.ts", prefix: "/api/admin/sale-returns", router: saleReturnRouter, method: "post", routePath: "/", path: "/", reason: "L", note: "G0 `NOT_IN_G0`（:729）＋ G1 C 类（:285）＋ G2 R 类（:350-362，同一 Router 双挂载）" },
  { file: "admin-quote-push.routes.ts", prefix: "/api/admin/quote-push", router: adminQuotePushRouter, method: "post", routePath: "/preview", path: "/preview", reason: "Q", note: "报价预览，**不改数据** ⇒ 按派单卡 §二.3「查询型 POST 不按写端点接」" },
  { file: "cart.routes.ts", prefix: "/api/miniapp/cart", router: miniappCartRouter, method: "post", routePath: "/add", path: "/add", reason: "C", note: "消费者端写端点（`routeConfig.auth = requireConsumerAuthWithTenant`，S3-196）；挂商家码会把消费者打成 403（S3-203 `trace:*` 教训）；静态门禁看不到声明式形态，见台账 §十四.7 卡外观察 1" },
  { file: "instant-retail-webhook.routes.ts", prefix: "/api/instant-retail", router: instantRetailWebhookRouter, method: "post", routePath: "/webhook/jd", path: "/webhook/jd", reason: "P", note: "平台回调：`routeConfig.auth = \"none\"`，京东/美团/饿了么服务器直调，无登录态 ⇒ 免鉴权" },
  { file: "position.routes.ts", prefix: "/api/admin/positions", router: positionRouter, method: "post", routePath: "/", path: "/", reason: "W", note: "岗位管理属组织/人事语义，`t_sys_menu` 无「岗位」细码；页面 `PositionManage.vue`（router:235）角色 = SUPER_ADMIN ⇒ 待授权模型定案" },
  { file: "instant-retail-admin-ops.routes.ts", prefix: "/api/admin/instant-retail", router: instantRetailAdminOpsRouter, method: "post", routePath: "/routing-rules", path: "/routing-rules", reason: "B", note: "app-mobile `pages-sub/finance/instant-retail/*` 三个孤岛页有写调用点（`pages.json` 注册但全仓无导航入口）⇒ 使用者集合不可枚举" },
];

/** 台账 §三.5 的本域端点总数（17 文件）= 本批已接 32 + 未接 55 + 已接线 13（非本批） */
const DOMAIN_TOTAL = 100;

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

/** 注入式挂载（模拟 auto-routes：认证 → CSRF 在挂载层，先于路由匹配） */
function buildApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-user"];
    const uid = raw ? Number(raw) : NaN;
    const u = USERS[uid];
    if (!u) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    (req as any).user = { id: uid, username: u.name, realName: u.name, roles: [...u.roles], storeId: u.storeId };
    (req as any).tenantId = "1";
    next();
  });
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

/** 真 JWT 挂载（`instant-retail-store.routes.ts` 的 routeConfig.auth = "none"，认证由内联 requireStoreAuth 承担） */
function buildRawApp(prefix: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

function call(app: express.Express, method: Method, url: string, uid?: number, raw?: boolean) {
  const req = request(app)[method](url);
  if (uid) {
    if (raw) {
      const u = USERS[uid];
      req
        // `tenantMiddleware` 要求 `req.user.tenantId`（middleware/tenant.ts:24-28）⇒ JWT 载荷必须带租户，
        // 否则先被拦成 403「缺少租户信息」，掩盖真实的权限判定结果（本单首版即因此 9 个用例红）。
        .set(
          "Authorization",
          `Bearer ${signToken({ id: uid, username: u.name, realName: u.name, roles: [...u.roles], storeId: u.storeId, tenantId: "default" } as never)}`
        )
        .set("x-csrf-token", generateCsrfToken(uid));
    } else {
      req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
    }
  }
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(row: { file: string; prefix: string; router: Router; rawMount?: boolean }) {
  const key = `${row.file}|${row.prefix}|${row.rawMount ? "raw" : "inj"}`;
  if (!APPS.has(key)) APPS.set(key, row.rawMount ? buildRawApp(row.prefix, row.router) : buildApp(row.prefix, row.router));
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

describe("S3-224 · 名单自证", () => {
  it("36 已接行（S3-224 的 32 行 + S3-233 收编 4 行；逐文件分布与台账 §十四.2/§十八 一致）", () => {
    expect(ROWS).toHaveLength(36);
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["admin-marketing-flash-sale.routes.ts", 2],
      ["admin-order.routes.ts", 4],
      ["admin-quote-push.routes.ts", 2],
      ["aftersale.routes.ts", 1],
      ["commerce-fix.routes.ts", 4],
      ["instant-retail-store.routes.ts", 4],
      ["order-timeout.routes.ts", 3],
      ["sale-return.routes.ts", 2],
      ["store-order.routes.ts", 8],
      ["store-sale-bill.routes.ts", 2],
      ["store-shift.routes.ts", 4],
    ]);
    // 本域 17 个文件里，本批 0 接线的 6 个（B/Q/P/C/W 类）
    for (const f of [
      "cart.routes.ts",
      "instant-retail-admin-ops.routes.ts",
      "instant-retail-admin-platform.routes.ts",
      "instant-retail-webhook.routes.ts",
      "order-exception.routes.ts",
      "position.routes.ts",
    ]) {
      expect(perFile.has(f), `${f} 本批应为 0 接线`).toBe(false);
    }
  });

  it("已接 32 行只用 5 个**既有**权限码（本批不新立权限点、不改角色种子、不动迁移）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual([
      "finance:daily-settle",
      "sale:create",
      "sale:edit",
      "sale:return",
      "sale:void",
    ]);
  });

  it("对账：台账 §三.5 本域 100 写端点 = 已接线 13（非本批） + 已接 36（S3-224 的 32 + S3-233 收编 4） + 未接 51", () => {
    expect(ROWS.length).toBe(36);
    expect(DOMAIN_TOTAL - 13 - ROWS.length).toBe(51);
  });
});

describe("S3-224 · 形状断言（注册行级判据，踩坑[134]）", () => {
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

  it("整文件子串不足以判定（踩坑[134]）：status 行必须**行级**自带 sale:create（S3-233 收编后契约反转）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "admin-order.routes.ts"), "utf8");
    expect(src).toContain('requirePermission("sale:edit")');
    const lines = registrationLines("admin-order.routes.ts", "put", "/orders/:orderNo/status");
    expect(lines).toHaveLength(1);
    // S3-233：该行由「未接」转为「已接」（依据门 sale-order-detail-deliver）；判据仍是"落到注册行本身"。
    expect(lines[0].line, "status 行必须行级自带该码").toContain('requirePermission("sale:create")');
  });

  it("同文件混合态自证：store-order.routes.ts 的 start-delivery 行与 accept 行**均已接**（S3-233 收编后同码）", () => {
    const started = registrationLines("store-order.routes.ts", "post", "/:orderNo/start-delivery");
    expect(started).toHaveLength(1);
    expect(started[0].line, "start-delivery 行必须行级自带该码").toContain('requirePermission("sale:create")');
    const accepted = registrationLines("store-order.routes.ts", "post", "/:orderNo/accept");
    expect(accepted).toHaveLength(1);
    expect(accepted[0].line).toContain('requirePermission("sale:create")');
  });

  it("两条既有锁定（L 类）注册行确无 requirePermission：sale-returns 创建 / sale-bills payment", () => {
    for (const [file, method, routePath] of [
      ["sale-return.routes.ts", "post", "/"],
      ["store-sale-bill.routes.ts", "post", "/:billNo/payment"],
    ] as Array<[string, Method, string]>) {
      const lines = registrationLines(file, method, routePath);
      expect(lines, `${file} ${method} ${routePath}`).toHaveLength(1);
      expect(lines[0].line).not.toContain("requirePermission(");
    }
  });

  it("公开端点（P 类）文件确为免鉴权（auth: \"none\"）⇒ 挂权限码既无意义也会把回调打成 401", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "instant-retail-webhook.routes.ts"), "utf8");
    expect(src).toMatch(/auth:\s*"none"/);
    expect(src).not.toContain("requirePermission(");
  });

  it("即时零售门店端（rawMount）在**内联 csrf 之后**挂 requirePermission（顺序：认证 → CSRF → 权限）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "instant-retail-store.routes.ts"), "utf8");
    for (const p of ["confirm", "cancel", "start-delivery", "complete-delivery"]) {
      const lines = registrationLines("instant-retail-store.routes.ts", "post", `/orders/:platformOrderId/${p}`);
      expect(lines).toHaveLength(1);
      const idxCsrf = lines[0].line.indexOf("csrfMiddleware");
      const idxPerm = lines[0].line.indexOf("requirePermission(");
      expect(idxCsrf, `${p}: csrf 必须在权限前`).toBeGreaterThanOrEqual(0);
      expect(idxPerm, `${p}: 权限必须在 csrf 后`).toBeGreaterThan(idxCsrf);
    }
  });
});

describe("S3-224 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("5 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    // sale:create：两个 `*` 角色 + 生产店长（`sale:*`）+ 销售员 / 门店操作员（079 精确码）
    expect(holdersOf("sale:create")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN, SALES_STAFF, STORE_OPERATOR]);
    // sale:edit / sale:void：仅两个 `*` 角色 + 生产店长（`sale:*` 域通配）——**不含**收银员
    expect(holdersOf("sale:edit")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    expect(holdersOf("sale:void")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    // sale:return：+ 门店操作员（生产实值精确码）
    expect(holdersOf("sale:return")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN, STORE_OPERATOR]);
    // finance:daily-settle：+ 财务（`finance:*`）——门店操作员生产实值亦持有（`finance:daily-settle`）
    expect(holdersOf("finance:daily-settle")).toEqual([SUPER_ADMIN, FINANCE_STAFF, STORE_MANAGER, OPERATION_ADMIN, STORE_OPERATOR]);
  });

  it("反证：READONLY 与客服对 5 个写码全不持有（`*:view` / `aftersale:*` 不覆盖 `sale:*` 写动作码）", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      expect(matchPermission(USERS[READONLY].perms, perm), `READONLY 不得持有 ${perm}`).toBe(false);
      expect(matchPermission(USERS[CUSTOMER_SERVICE].perms, perm), `客服不得持有 ${perm}`).toBe(false);
    }
  });

  it("判据有分辨力：`sale:view` 与旧词表 `order:write` 都不覆盖 `sale:void` / `sale:create`", () => {
    expect(matchPermission(USERS[STORE_OPERATOR].perms, "sale:view")).toBe(true);
    expect(matchPermission(USERS[STORE_OPERATOR].perms, "sale:void")).toBe(false);
    expect(matchPermission(USERS[STORE_ADMIN_LEGACY].perms, "order:write")).toBe(true);
    expect(matchPermission(USERS[STORE_ADMIN_LEGACY].perms, "sale:create")).toBe(false);
  });

  it("高风险动作口径（派单卡 §二.4）：订单/销售单取消类码**不含**收银员与销售员", () => {
    for (const uid of [STORE_OPERATOR, SALES_STAFF]) {
      expect(matchPermission(USERS[uid].perms, "sale:void"), `${USERS[uid].name} 不得持有 sale:void`).toBe(false);
      expect(matchPermission(USERS[uid].perms, "sale:cancel"), `${USERS[uid].name} 不得持有 sale:cancel`).toBe(false);
    }
    expect(matchPermission(USERS[STORE_MANAGER].perms, "sale:void")).toBe(true);
  });
});

describe("S3-224 · 两侧判据 a) 缺码 ⇒ 403 且未到达业务层", () => {
  it.each(ROWS)("$file $method $routePath：READONLY ⇒ 403 且 msg 指向该权限码", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY, row.rawMount);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });

  it.each(ROWS)("$file $method $routePath：全部非持有人（逐账号枚举）⇒ 403", async (row) => {
    for (const uid of nonHoldersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid, row.rawMount);
      expect(res.status, `${USERS[uid].name} 不应通过 ${label(row)}`).toBe(403);
      expect(h.reached, `${USERS[uid].name} 不得到达 ${label(row)} 的业务层`).toEqual([]);
    }
  });
});

describe("S3-224 · 两侧判据 b) 有码 ⇒ 通过（不锁死既有页面角色）", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid, row.rawMount);
      expect(res.status, `${USERS[uid].name} 应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it("零回归（机器复算）：凡有页面调用点的行，**页面角色 ⊆ 码持有人**（页面角色用真实账号逐个试跑 ⇒ 200）", async () => {
    const withPages = ROWS.filter((r) => r.pageRoles.length > 0);
    expect(withPages.length, "本批有页面调用点的行数").toBeGreaterThan(0);
    for (const row of withPages) {
      for (const role of row.pageRoles) {
        const uid = PAGE_ROLE_USER[role];
        expect(uid, `未登记页面角色 ${role} 的测试账号`).toBeDefined();
        h.reached.length = 0;
        const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid, row.rawMount);
        expect(res.status, `页面角色 ${role}（${USERS[uid].name}）被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
      }
    }
  });

  it("零回归（逐条文字依据）：每一条**有页面调用点**的行都必须在 page 字段写明文件:行", () => {
    for (const row of ROWS.filter((r) => r.pageRoles.length > 0)) {
      expect(row.page, `${label(row)} 缺少使用者依据`).toMatch(/\.vue:\d+/);
    }
  });
});

describe("S3-224 · 范围控制：本批未接行 READONLY 仍到达业务层（证明没多接、也没偷接待定项）", () => {
  it.each(UNWIRED)("$file $method $routePath（未接，原因 $reason）：READONLY ⇒ 200 且到达业务层", async (row) => {
    h.reached.length = 0;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY, row.rawMount);
    expect(res.status, `${label(row)} 不得被本批误拦`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length, `${label(row)} 应到达业务层`).toBeGreaterThan(0);
  });

  it("六类未接原因齐备（B/L/Q/P/C/W 各至少 1 条，避免只取样一类）", () => {
    expect([...new Set(UNWIRED.map((r) => r.reason))].sort()).toEqual(["B", "C", "L", "P", "Q", "W"]);
  });
});

describe("S3-224 · 未登录 ⇒ 401（既有行为不变）", () => {
  it("注入式挂载：status 行与已接行同样 401", async () => {
    for (const row of [ROWS[0], UNWIRED[0]]) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
      expect(res.status, `${label(row)} 未登录应 401`).toBe(401);
    }
  });

  it("真 JWT 挂载（instant-retail-store）：无 Bearer ⇒ 401（认证仍在前）", async () => {
    const row = ROWS.find((r) => r.rawMount)!;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });
});
