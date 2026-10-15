/**
 * S3-222 · **客户域**（12 路由文件 / 45 写端点）权限接线验收测试（B2 批 4）
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-222.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.2（域明细）＋ §十二（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` 546 条 / 138 文件）
 * 基线：`origin/main` = `e124173b`（本单开工时 `git fetch` 取真值，见回执 §三）
 *
 * 本文件要证明的六件事（对应派单卡 §三.1/§三.2/§三.5）：
 *  a) 本批已接 **42 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 42 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「页面/按钮真实使用者持有该码」逐条钉进测试）；
 *  d) 反证：**不持有**该码的账号一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 3 行（2 条公开端点 + 1 条待授权模型定案）⇒ 注册行级不含
 *     `requirePermission(`，且 READONLY 仍能到达业务层（证明本批「没多接」，也没把待定项偷接）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 角色权限串：生产只读实值（`STORE_MANAGER` / `FINANCE_STAFF` / `STORE_OPERATOR` / `WAREHOUSE_STAFF`，
 *    凌舟 2026-10-15 生产核对，见 `docs/evidence/S3-214/01-roles-to-verify.md` §「凌舟生产核对结论」）
 *    ＋ 仓库种子（`079_权限矩阵.sql` / `099_seed_data.sql` 旧词表口径），与 `guard-rbac-wiring.mjs --holders` 同源；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）＋
 *    `app-mobile/src/config/function-menu.ts` 的移动菜单码（对账页 `finance:statement`）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-222/` 下反测日志与回执 §五）。
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
vi.mock("@controllers/admin/customer.controller", () => h.stub());
vi.mock("@controllers/admin/member.controller", () => h.stub());
vi.mock("@controllers/admin/customer-lifecycle.controller", () => h.stub());
vi.mock("@controllers/admin/customer-care.controller", () => h.stub());
vi.mock("@controllers/admin/customer-merge.controller", () => h.stub());
vi.mock("@controllers/customer-payment.controller", () => h.stub());
vi.mock("@controllers/admin/customer-price.controller", () => h.stub());
vi.mock("@controllers/admin/customer-segment.controller", () => h.stub());
vi.mock("@controllers/customer-statement.controller", () => h.stub());
vi.mock("@controllers/admin/customer-tag.controller", () => h.stub());
vi.mock("@controllers/admin/customer-type.controller", () => h.stub());
vi.mock("@controllers/admin/customer-visit.controller", () => h.stub());
vi.mock("@controllers/admin/member-register.controller", () => h.stub());
vi.mock("@controllers/admin/tag.controller", () => h.stub());

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
import { adminCustomerRouter } from "../../routes/admin-customer.routes";
import { customerCareRouter } from "../../routes/customer-care.routes";
import { customerMergeRouter } from "../../routes/customer-merge.routes";
import { customerPaymentRouter } from "../../routes/customer-payment.routes";
import { customerPriceRouter } from "../../routes/customer-price.routes";
import { customerSegmentRouter } from "../../routes/customer-segment.routes";
import { customerStatementRouter } from "../../routes/customer-statement.routes";
import { customerTagRouter } from "../../routes/customer-tag.routes";
import { customerTypeRouter } from "../../routes/customer-type.routes";
import { customerVisitRouter } from "../../routes/customer-visit.routes";
import { memberRegisterRouter } from "../../routes/member-register.routes";
import { tagRouter } from "../../routes/tag.routes";

/**
 * 测试账号：权限串 = 生产只读实值（9009/9006/9013/9011）＋ 仓库种子（9012/9014/9001/9015）。
 * 9009 = 生产店长（`customer:*` 覆盖客户域全部写码）；9006 = 财务（仅 `customer:statement`）；
 * 9012 = 销售员（`customer:view` + `customer:visit`）；9014 = 客服（仅 `customer:view`）；
 * 9015 = `STORE_ADMIN` 旧词表口径（`customer:read`，**不覆盖**任何 `customer:<写动作>`）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
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
  9014: {
    name: "customer_service",
    roles: ["CUSTOMER_SERVICE"],
    perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"],
  },
  9015: {
    name: "store_admin_legacy",
    roles: ["STORE_ADMIN"],
    perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write", "customer:read"],
  },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const FINANCE_STAFF = 9006;
const STORE_MANAGER = 9009;
const OPERATION_ADMIN = 9010;
const SALES_STAFF = 9012;
const CUSTOMER_SERVICE = 9014;
const STORE_ADMIN_LEGACY = 9015;

/** 页面角色 → 测试账号（用于「页面角色 ⊆ 码持有人」的机器复算） */
const PAGE_ROLE_USER: Record<string, number> = {
  SUPER_ADMIN,
  STORE_MANAGER,
};

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
  /** 真实使用者（页面 / 按钮 / 移动端入口；`[]` = 全仓无调用方，仅 API 策略面） */
  pageRoles: string[];
  page: string;
}

/**
 * 本批已接名单（**42 行**，逐行判定见台账 §十二 / 回执 §一）。
 * 口径（派单卡 §二）：① 优先挂「该端点**真实使用者已持有**的模块码」（零回归）；
 * ② 找不到使用者已持有码 ⇒ 不接线（见 UNWIRED）；③ 本批**不新立权限码、不改角色种子**。
 */
const ROWS: Row[] = [
  // ---- admin-customer.routes.ts（6）----
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "post", routePath: "/members", path: "/members", perm: "customer:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomersView.vue:276（客户管理 pages/customers，router:160）" },
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "put", routePath: "/members/:id", path: "/members/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerDetail.vue:485（客户详情，router:161）" },
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "put", routePath: "/members/:id/disable", path: "/members/1/disable", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerDetail.vue:457 / CustomersView.vue:332" },
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "put", routePath: "/members/:id/assign-staff", path: "/members/1/assign-staff", perm: "customer:edit", pageRoles: [], page: "无页面调用方（admin-web `assignMember` 打的是 /members/:id/assign，路径漂移，见台账 §十二 卡外观察 3）" },
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "post", routePath: "/members/register", path: "/members/register", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "MemberSystem.vue:127（会员体系，router:152）；台账原判「公开端点」有误（本文件 routeConfig.auth=requireAuthWithTenant）" },
  { file: "admin-customer.routes.ts", prefix: "/api/admin", router: adminCustomerRouter, method: "put", routePath: "/members/:id/member-level", path: "/members/1/member-level", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "LevelConfig.vue:302（等级配置）+ CustomerDetail.vue:509" },

  // ---- customer-care.routes.ts（4）----
  { file: "customer-care.routes.ts", prefix: "/api/admin/members/care", router: customerCareRouter, method: "post", routePath: "/rules", path: "/rules", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerCareRules.vue:194（客户关怀，router:155）" },
  { file: "customer-care.routes.ts", prefix: "/api/admin/members/care", router: customerCareRouter, method: "put", routePath: "/rules/:id", path: "/rules/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerCareRules.vue:191" },
  { file: "customer-care.routes.ts", prefix: "/api/admin/members/care", router: customerCareRouter, method: "delete", routePath: "/rules/:id", path: "/rules/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerCareRules.vue:204" },
  { file: "customer-care.routes.ts", prefix: "/api/admin/members/care", router: customerCareRouter, method: "post", routePath: "/rules/:id/execute", path: "/rules/1/execute", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerCareRules.vue:210" },

  // ---- customer-merge.routes.ts（1）----
  { file: "customer-merge.routes.ts", prefix: "/api/admin/customer-merge", router: customerMergeRouter, method: "post", routePath: "/merge", path: "/merge", perm: "customer:create", pageRoles: [], page: "无页面调用方（全仓仅 服务层单测）" },

  // ---- customer-payment.routes.ts（2）----
  { file: "customer-payment.routes.ts", prefix: "/api/store/customer-payments", router: customerPaymentRouter, method: "post", routePath: "/", path: "/", perm: "customer:payment", pageRoles: [], page: "无页面调用方（admin-web `createCustomerPayment` 打的是 /admin/customer-payments，死路径）" },
  { file: "customer-payment.routes.ts", prefix: "/api/store/customer-payments", router: customerPaymentRouter, method: "post", routePath: "/:receiptNo/void", path: "/RC1/void", perm: "customer:payment", pageRoles: [], page: "无页面调用方（同上）" },

  // ---- customer-price.routes.ts（3）----
  { file: "customer-price.routes.ts", prefix: "/api/admin/customer-prices", router: customerPriceRouter, method: "post", routePath: "/", path: "/", perm: "customer:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerPrices.vue:291（客户价格 sales/customer-prices，router:111）" },
  { file: "customer-price.routes.ts", prefix: "/api/admin/customer-prices", router: customerPriceRouter, method: "put", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerPrices.vue（编辑按钮）" },
  { file: "customer-price.routes.ts", prefix: "/api/admin/customer-prices", router: customerPriceRouter, method: "delete", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerPrices.vue:308" },

  // ---- customer-segment.routes.ts（4）----
  { file: "customer-segment.routes.ts", prefix: "/api/admin/members/segments", router: customerSegmentRouter, method: "post", routePath: "/", path: "/", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerSegments.vue:200（客户分群，router:158）" },
  { file: "customer-segment.routes.ts", prefix: "/api/admin/members/segments", router: customerSegmentRouter, method: "put", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerSegments.vue（编辑按钮）" },
  { file: "customer-segment.routes.ts", prefix: "/api/admin/members/segments", router: customerSegmentRouter, method: "delete", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerSegments.vue:210" },
  { file: "customer-segment.routes.ts", prefix: "/api/admin/members/segments", router: customerSegmentRouter, method: "post", routePath: "/:id/refresh", path: "/1/refresh", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerSegments.vue:216" },

  // ---- customer-statement.routes.ts（2 / 3；confirm 见 UNWIRED）----
  { file: "customer-statement.routes.ts", prefix: "/api/store/customer-statements", router: customerStatementRouter, method: "post", routePath: "/", path: "/", perm: "customer:statement", pageRoles: [], page: "无页面调用方（admin-web `generateCustomerStatement` 打的是 /store/customer-statements/generate，死路径）" },
  { file: "customer-statement.routes.ts", prefix: "/api/store/customer-statements", router: customerStatementRouter, method: "post", routePath: "/:statementNo/paid", path: "/ST1/paid", perm: "customer:statement", pageRoles: [], page: "无页面调用方（与对账同族）" },

  // ---- customer-tag.routes.ts（5）----
  { file: "customer-tag.routes.ts", prefix: "/api/admin/members/tags", router: customerTagRouter, method: "post", routePath: "/", path: "/", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerTags.vue:201（客户标签，router:153）" },
  { file: "customer-tag.routes.ts", prefix: "/api/admin/members/tags", router: customerTagRouter, method: "put", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerTags.vue:198" },
  { file: "customer-tag.routes.ts", prefix: "/api/admin/members/tags", router: customerTagRouter, method: "delete", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerTags.vue:211" },
  { file: "customer-tag.routes.ts", prefix: "/api/admin/members/tags", router: customerTagRouter, method: "post", routePath: "/:id/tags", path: "/1/tags", perm: "customer:create", pageRoles: [], page: "无页面调用方（admin-web 打 /members/tags/add，路径漂移，见台账 §十二 卡外观察 2）" },
  { file: "customer-tag.routes.ts", prefix: "/api/admin/members/tags", router: customerTagRouter, method: "delete", routePath: "/:id/tags/:tagId", path: "/1/tags/2", perm: "customer:edit", pageRoles: [], page: "无页面调用方（同上 /members/tags/remove）" },

  // ---- customer-type.routes.ts（3）----
  { file: "customer-type.routes.ts", prefix: "/api/admin/customer-types", router: customerTypeRouter, method: "post", routePath: "/", path: "/", perm: "customer:create", pageRoles: ["SUPER_ADMIN"], page: "CustomerTypes.vue:211（客户类型，router:162）" },
  { file: "customer-type.routes.ts", prefix: "/api/admin/customer-types", router: customerTypeRouter, method: "put", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerTypes.vue（编辑按钮）" },
  { file: "customer-type.routes.ts", prefix: "/api/admin/customer-types", router: customerTypeRouter, method: "delete", routePath: "/:id", path: "/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN"], page: "CustomerTypes.vue:249" },

  // ---- customer-visit.routes.ts（5）----
  { file: "customer-visit.routes.ts", prefix: "/api/admin/customer-visits", router: customerVisitRouter, method: "post", routePath: "/", path: "/", perm: "customer:visit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerVisits.vue:431（拜访记录，router:156）" },
  { file: "customer-visit.routes.ts", prefix: "/api/admin/customer-visits", router: customerVisitRouter, method: "put", routePath: "/:visitNo", path: "/V1", perm: "customer:visit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "CustomerVisits.vue:428" },
  { file: "customer-visit.routes.ts", prefix: "/api/admin/customer-visits", router: customerVisitRouter, method: "post", routePath: "/:visitNo/checkin", path: "/V1/checkin", perm: "customer:visit", pageRoles: [], page: "无页面调用方（api/misc.ts 有导出、无页面引用）" },
  { file: "customer-visit.routes.ts", prefix: "/api/admin/customer-visits", router: customerVisitRouter, method: "post", routePath: "/:visitNo/checkout", path: "/V1/checkout", perm: "customer:visit", pageRoles: [], page: "无页面调用方（同上）" },
  { file: "customer-visit.routes.ts", prefix: "/api/admin/customer-visits", router: customerVisitRouter, method: "post", routePath: "/:visitNo/cancel", path: "/V1/cancel", perm: "customer:visit", pageRoles: [], page: "无页面调用方（同上）" },

  // ---- tag.routes.ts（7）----
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "post", routePath: "/tags/groups", path: "/tags/groups", perm: "customer:create", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "TagGroups.vue:316（标签分组 products/tag-groups，router:171）" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "put", routePath: "/tags/groups/:id", path: "/tags/groups/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "TagGroups.vue:311" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "delete", routePath: "/tags/groups/:id", path: "/tags/groups/1", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "TagGroups.vue（删除分组）" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "post", routePath: "/tags", path: "/tags", perm: "customer:create", pageRoles: [], page: "无页面调用方（前端打的是 /admin/product-tags，属商品域另文件）" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "put", routePath: "/tags/:id", path: "/tags/1", perm: "customer:edit", pageRoles: [], page: "无页面调用方（同上）" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "delete", routePath: "/tags/:id", path: "/tags/1", perm: "customer:edit", pageRoles: [], page: "无页面调用方（同上）" },
  { file: "tag.routes.ts", prefix: "/api/admin", router: tagRouter, method: "put", routePath: "/products/:spuId/tags", path: "/products/9/tags", perm: "customer:edit", pageRoles: ["SUPER_ADMIN", "STORE_MANAGER"], page: "ProductTagRelation.vue:133 / Products.vue:1358（标签关联 :172 / 商品管理 :165）" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /** P = 真公开端点（routeConfig auth:"none"，免鉴权）；W = 待授权模型定案 */
  reason: "P" | "W";
  note: string;
}

/** 本域**本批未接**的 3 行（逐条原因见台账 §十二.3）。 */
const UNWIRED: UnwiredRow[] = [
  { file: "member-register.routes.ts", prefix: "/api/store/members", router: memberRegisterRouter, method: "post", routePath: "/sms-code", path: "/sms-code", reason: "P", note: "member-register.routes.ts routeConfig.auth = \"none\"（真免鉴权）；调用方 app-mobile/src/api/modules/member.ts:23" },
  { file: "member-register.routes.ts", prefix: "/api/store/members", router: memberRegisterRouter, method: "post", routePath: "/register", path: "/register", reason: "P", note: "同上（member.ts:27，注册开通）" },
  { file: "customer-statement.routes.ts", prefix: "/api/store/customer-statements", router: customerStatementRouter, method: "post", routePath: "/:statementNo/confirm", path: "/ST1/confirm", reason: "W", note: "移动端对账单页 statements.vue:97（菜单码 finance:statement）可见角色 = {FINANCE_STAFF, OPERATION_ADMIN, READONLY, STORE_ADMIN}，其中 READONLY(`*:view`) 与 STORE_ADMIN（099 旧词表）不持任何客户域写码 ⇒ 接线即 403（批 1 trace:* 同款形态）" },
];

/** 台账 §三.2 的本域写端点总数（12 文件） = 本批已接 42 + 未接 3 */
const DOMAIN_TOTAL = 45;

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

describe("S3-222 · 名单自证", () => {
  it("42 已接 + 3 未接 = 45（= 台账 §三.2 本域写端点总数）", () => {
    expect(ROWS).toHaveLength(42);
    expect(UNWIRED).toHaveLength(3);
    expect(ROWS.length + UNWIRED.length).toBe(DOMAIN_TOTAL);
  });

  it("已接 42 行的逐文件分布（与台账 §十二 表一致；10 个文件清零）", () => {
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
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
    // 12 个文件里 member-register.routes.ts 是**唯一**本批 0 接线的（2 条真公开端点）
    expect(perFile.has("member-register.routes.ts")).toBe(false);
  });

  it("已接 42 行只用 5 个**既有**权限码（本批不新立权限点、不改角色种子）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual([
      "customer:create",
      "customer:edit",
      "customer:payment",
      "customer:statement",
      "customer:visit",
    ]);
  });
});

describe("S3-222 · 形状断言（注册行级判据，踩坑[134]）", () => {
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

  it("整文件子串不足以判定（踩坑[134]）：customer-statement.routes.ts 文件级已含 requirePermission，被排除的 confirm 行没有", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "customer-statement.routes.ts"), "utf8");
    expect(src).toContain('requirePermission("customer:statement")');
    const lines = registrationLines("customer-statement.routes.ts", "post", "/:statementNo/confirm");
    expect(lines).toHaveLength(1);
    expect(lines[0].line, "移动端确认行不得被误判为已接线").not.toContain("requirePermission(");
  });

  it("未接的 member-register.routes.ts 是**真公开端点**（routeConfig.auth = \"none\"，非漏接）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "member-register.routes.ts"), "utf8");
    expect(src).toMatch(/auth:\s*"none"/);
    expect(src).not.toContain("requirePermission(");
  });

  it("反例：`/api/admin/members/register` **不是**公开端点（本文件挂 requireAuthWithTenant）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "admin-customer.routes.ts"), "utf8");
    expect(src).toMatch(/auth:\s*"requireAuthWithTenant"/);
    expect(src).toContain('requirePermission("customer:create")');
  });
});

describe("S3-222 · 权限持有人集合复算（生产 matchPermission × 角色权限串）", () => {
  it("5 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    // customer:create / customer:edit：两个 `*` 角色 + 生产店长（`customer:*` 通配）
    expect(holdersOf("customer:create")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    expect(holdersOf("customer:edit")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    // customer:visit：+ 销售员（079 种子精确码 `customer:visit`）
    expect(holdersOf("customer:visit")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN, SALES_STAFF]);
    // customer:statement：+ 财务（079 种子精确码 `customer:statement`；销售员/客服**不**持有）
    expect(holdersOf("customer:statement")).toEqual([SUPER_ADMIN, FINANCE_STAFF, STORE_MANAGER, OPERATION_ADMIN]);
    // customer:payment：仅两个 `*` 角色 + 店长（`customer:*`）；财务的 `finance:*` **不**覆盖客户域
    expect(holdersOf("customer:payment")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
  });

  it("反证：READONLY 与客服对 5 个写码全不持有（`*:view` / `customer:view` 不覆盖写动作码）", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      expect(matchPermission(USERS[READONLY].perms, perm), `READONLY 不得持有 ${perm}`).toBe(false);
      expect(matchPermission(USERS[CUSTOMER_SERVICE].perms, perm), `客服不得持有 ${perm}`).toBe(false);
    }
  });

  it("判据有分辨力：`customer:view` 与旧词表 `customer:read` 都不覆盖 `customer:edit`", () => {
    expect(matchPermission(USERS[CUSTOMER_SERVICE].perms, "customer:view")).toBe(true);
    expect(matchPermission(USERS[CUSTOMER_SERVICE].perms, "customer:edit")).toBe(false);
    expect(matchPermission(USERS[STORE_ADMIN_LEGACY].perms, "customer:read")).toBe(true);
    expect(matchPermission(USERS[STORE_ADMIN_LEGACY].perms, "customer:edit")).toBe(false);
  });

  it("STORE_ADMIN 旧词表口径不持任何客户域写码 ⇒ 对账 confirm 行若硬接必 403（本批不接的理由）", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      expect(matchPermission(USERS[STORE_ADMIN_LEGACY].perms, perm), `旧词表角色不得持有 ${perm}`).toBe(false);
    }
  });
});

describe("S3-222 · 两侧判据 a) 缺码 ⇒ 403 且未到达业务层", () => {
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

describe("S3-222 · 两侧判据 b) 有码 ⇒ 通过（不锁死既有页面角色）", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name} 应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it("零回归（机器复算）：每一行的**页面角色 ⊆ 码持有人**（页面角色用真实账号逐个试跑 ⇒ 200）", async () => {
    const checked: string[] = [];
    for (const row of ROWS) {
      for (const role of row.pageRoles) {
        const uid = PAGE_ROLE_USER[role];
        expect(uid, `未登记的页面角色：${role}`).toBeDefined();
        h.reached.length = 0;
        const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
        expect(res.status, `${role} 必须过 ${label(row)}（零回归）`).toBe(200);
        checked.push(`${label(row)}|${role}`);
      }
    }
    // 断言「确实核过」的数量：42 行里 31 行有页面角色（含双角色行），少于该数是漏核
    expect(checked.length).toBeGreaterThanOrEqual(38);
  });

  it("生产店长（`customer:*`）通过本批**全部** 42 行（客户域写码全被 `customer:*` 覆盖）", async () => {
    for (const row of ROWS) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, STORE_MANAGER);
      expect(res.status, `店长应通过 ${label(row)}`).toBe(200);
    }
  });
});

describe("S3-222 · 两侧判据 e) 范围控制：未接的 3 行不得被偷接", () => {
  it.each(UNWIRED)("$file $method $routePath（$reason）：无权限门 ⇒ READONLY 亦到达业务层", async (row) => {
    h.reached.length = 0;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});

describe("S3-222 · 两侧判据 f) 未登录 ⇒ 401（既有行为不变）", () => {
  const sample = [ROWS[0], ROWS[20], ROWS[ROWS.length - 1]];
  it.each(sample)("$file $method $routePath：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(h.reached).toEqual([]);
  });
});
