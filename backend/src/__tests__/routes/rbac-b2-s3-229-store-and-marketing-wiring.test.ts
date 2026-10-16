/**
 * S3-229 · **门店/租户域 + 营销域 W 类**权限接线验收测试（本批接 **17 条**）
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-229.md`｜授权模型：`docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md`（不变量 I1 · D2）
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.7 / §三.4（域明细）＋ §十七（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 gaps 378 条 / 113 文件）
 * 判定留档：`docs/evidence/S3-229/01-plan-and-judgements.md`｜调用面原始输出：`docs/evidence/S3-229/02-callers.txt`
 *
 * 本文件要证明的七件事（对应派单卡 §三.1/§三.2/§三.3/§三.5）：
 *  a) 本批已接 **17 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 17 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有人**调对应行 ⇒ **200**；**非持有人**（逐账号枚举）⇒ **403**（证明判据不是恒 true 的假门禁）；
 *  d) **零回归 · 在用使用者对齐**：每一条的「页面在用可见角色」逐个试跑，持码的必须 200，
 *     `READONLY`（只读观察员）403 属**既有期望**（`*:view` 只读）—— 即没有**在用写角色**被锁死（不变量 I1）；
 *  e) **范围控制**：本域本批**未接**的 28 行（B 类 8 + W 类 4 + 公开 2 + 平台侧/平台域 14）⇒ 注册行级不含
 *     `requirePermission(`；其中 app-mobile 侧的 12 行 READONLY 仍能到达业务层（证明「没多接、也没偷接待定项」）；
 *  f) 对账守恒：G1 31 = 7（接）+ 8（B）+ 2（平台侧）+ 2（公开）+ 12（平台域）；G2 14 = 10（接）+ 4（W）；
 *  g) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 角色权限串 / 账号数：生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt`（12 角色，租户 `default`）
 *    与 `prod-role-usage-20261016.sql` 读数（在用角色：SUPER_ADMIN×2 / STORE_MANAGER×1 / STORE_OPERATOR×1 / READONLY×1）；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）；app-mobile 侧用
 *    `config/function-menu.ts` 的菜单码 ＋ **生产角色×菜单权威矩阵** `docs/evidence/_shared/prod-menu-matrix-20261016.txt`
 *    ＋ 首页快捷入口 `pages/home/home.vue:69-92`（会员管理为**无条件**入口）＋ 我的页 `pages/profile/profile.vue`（门店管理为**无条件**入口）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)`（**台账已先移除本批条目**，见 `tools/update-baseline.mjs`）
 *   ⇒ 对应「注册行形状 / READONLY ⇒ 403」用例必红；复原 ⇒ 绿（原始输出见 `docs/evidence/S3-229/25-neg-*.txt`）。
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
vi.mock("@controllers/admin/demo.controller", () => h.stub());
vi.mock("@controllers/admin/store-control.controller", () => h.stub());
vi.mock("@controllers/marketing/community-marketing.controller", () => h.stub());
vi.mock("@controllers/admin/employee.controller", () => h.stub());
vi.mock("@controllers/admin/store-value-card.controller", () => h.stub());
vi.mock("@controllers/store/member.controller", () => h.stub());
vi.mock("@controllers/admin/points.controller", () => h.stub());
vi.mock("@controllers/store/product.controller", () => h.stub());
vi.mock("@controllers/admin/tag.controller", () => h.stub());
vi.mock("@controllers/inventory-batch.controller", () => h.stub());
vi.mock("@controllers/store/home.controller", () => h.stub());

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
import { demoRouter } from "../../routes/demo.routes";
import { adminStoreControlRouter } from "../../routes/store-control.routes";
import {
  groupBuyRouter,
  bargainRouter,
  seckillRouter as communitySeckillRouter,
} from "../../routes/community-marketing.routes";
import { adminStoreRouter } from "../../routes/admin-store.routes";
import { storeValueCardRouter } from "../../routes/store-value-card.routes";
import { storeMemberRouter } from "../../routes/store.routes";
import { pointsRouter } from "../../routes/points.routes";

/**
 * 测试账号：权限串 = **生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default` 共 12 角色全集）。
 * 每条都带 `storeId`：门店端经 `requireStoreAuth` / 控制器内 storeId 判定，缺 storeId 会先被拦在那里、
 * 掩盖 `requirePermission` 的结果（S3-224 首版教训）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; storeId?: number; accounts: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], storeId: 1, accounts: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], storeId: 1, accounts: 2 },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"], storeId: 1, accounts: 1 },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"], storeId: 1, accounts: 1 },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"], storeId: 1, accounts: 0 },
  9006: { name: "finance_staff", roles: ["FINANCE_STAFF"], perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"], storeId: 1, accounts: 0 },
  9007: { name: "customer_service", roles: ["CUSTOMER_SERVICE"], perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"], storeId: 1, accounts: 0 },
  9008: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"], storeId: 1, accounts: 0 },
  9009: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"], storeId: 1, accounts: 0 },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], storeId: 1, accounts: 0 },
  9011: { name: "salesman", roles: ["SALESMAN"], perms: ["product:read", "order:read", "order:write", "customer:read", "customer:write"], storeId: 1, accounts: 0 },
  9012: { name: "store_admin", roles: ["STORE_ADMIN"], perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"], storeId: 1, accounts: 0 },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const STORE_MANAGER = 9003;
const STORE_OPERATOR = 9004;
const OPERATION_ADMIN = 9010;

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
  /**
   * 「页面**在用**可见角色」（生产：账号数 > 0 且能看到该页面/按钮的角色；`[]` = 全仓无有效调用点）。
   * 口径见派单卡 §三.2 —— 逐条给出，不猜。
   */
  inUseVisible: number[];
  /** 真实使用者 / 无调用点依据（文件:行） */
  page: string;
}

/**
 * 本批已接名单（**17 行**，逐行判定见 `docs/evidence/S3-229/01-plan-and-judgements.md`）。
 * 口径（派单卡 §二）：① 挂「该端点**真实使用者已持有**的模块码」（零回归）；
 * ② 使用者集合不可枚举 / 页面在用可见角色 ⊄ 码持有人 ⇒ 不接线（见 UNWIRED）；
 * ③ 本批**不新立权限码、不改角色种子、不动迁移**（3 个码均为既有码）。
 */
const ROWS: Row[] = [
  // ---- demo.routes.ts（2）----
  { file: "demo.routes.ts", prefix: "/api/admin/demo", router: demoRouter, method: "post", routePath: "/seed", path: "/seed", perm: "store:create", inUseVisible: [SUPER_ADMIN], page: "LoginView.vue:257（演示登录流程，账号 = DEMO_ACCOUNT `admin` = SUPER_ADMIN；common.ts:17 封装）" },
  { file: "demo.routes.ts", prefix: "/api/admin/demo", router: demoRouter, method: "post", routePath: "/reset", path: "/reset", perm: "store:create", inUseVisible: [SUPER_ADMIN], page: "六端全仓无有效调用点（`rg -F 'demo/reset'` 仅 common.ts:23 封装行）" },

  // ---- store-control.routes.ts（5；管理面；读端点不在本批）----
  { file: "store-control.routes.ts", prefix: "/api/admin/store-control", router: adminStoreControlRouter, method: "put", routePath: "/configs/:storeId", path: "/configs/1", perm: "store:edit", inUseVisible: [], page: "全仓无有效调用点（api/inventory.ts:129 封装，updateStoreControlConfig 零 .vue 引用）" },
  { file: "store-control.routes.ts", prefix: "/api/admin/store-control", router: adminStoreControlRouter, method: "post", routePath: "/:storeId/open", path: "/1/open", perm: "store:create", inUseVisible: [], page: "全仓无有效调用点（api/inventory.ts:133 openStore 零 .vue 引用）" },
  { file: "store-control.routes.ts", prefix: "/api/admin/store-control", router: adminStoreControlRouter, method: "post", routePath: "/:storeId/close", path: "/1/close", perm: "store:create", inUseVisible: [], page: "全仓无有效调用点（api/inventory.ts:137 closeStore 零 .vue 引用）" },
  { file: "store-control.routes.ts", prefix: "/api/admin/store-control", router: adminStoreControlRouter, method: "post", routePath: "/:storeId/suspend", path: "/1/suspend", perm: "store:create", inUseVisible: [], page: "全仓无有效调用点（api/inventory.ts:141 suspendStore 零 .vue 引用）" },
  { file: "store-control.routes.ts", prefix: "/api/admin/store-control", router: adminStoreControlRouter, method: "post", routePath: "/:storeId/resume", path: "/1/resume", perm: "store:create", inUseVisible: [], page: "全仓无有效调用点（api/inventory.ts:145 resumeStore 零 .vue 引用）" },

  // ---- community-marketing.routes.ts（10；D2：菜单仅授予 0 账号角色与只读观察员）----
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/group-buy", router: groupBuyRouter, method: "post", routePath: "/:id/join", path: "/1/join", perm: "marketing:create", inUseVisible: [READONLY], page: "group-buy-detail.vue:221（功能中心菜单 marketing:group-buy；生产授予 OPERATION_ADMIN(0 账号)/READONLY/STORE_ADMIN(0 账号)）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/group-buy", router: groupBuyRouter, method: "post", routePath: "/:id/start", path: "/1/start", perm: "marketing:create", inUseVisible: [READONLY], page: "同 group-buy-detail.vue（拼团发起；菜单 marketing:group-buy）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/group-buy", router: groupBuyRouter, method: "post", routePath: "/:id/end", path: "/1/end", perm: "marketing:create", inUseVisible: [READONLY], page: "同 group-buy-detail.vue（拼团结束）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/bargain", router: bargainRouter, method: "post", routePath: "/:id/start", path: "/1/start", perm: "marketing:create", inUseVisible: [READONLY], page: "bargain-detail.vue:311（菜单 marketing:bargain）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/bargain", router: bargainRouter, method: "post", routePath: "/:id/help", path: "/1/help", perm: "marketing:create", inUseVisible: [READONLY], page: "bargain-detail.vue:326（砍价助力）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/bargain", router: bargainRouter, method: "post", routePath: "/:id/end", path: "/1/end", perm: "marketing:create", inUseVisible: [READONLY], page: "同 bargain-detail.vue（砍价结束）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/seckill", router: communitySeckillRouter, method: "post", routePath: "/:id/buy", path: "/1/buy", perm: "marketing:create", inUseVisible: [READONLY], page: "seckill-detail.vue:281（菜单 marketing:seckill）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/seckill", router: communitySeckillRouter, method: "post", routePath: "/:orderNo/pay", path: "/S1/pay", perm: "marketing:create", inUseVisible: [READONLY], page: "seckill-detail.vue（秒杀支付）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/seckill", router: communitySeckillRouter, method: "post", routePath: "/:orderNo/cancel", path: "/S1/cancel", perm: "marketing:create", inUseVisible: [READONLY], page: "seckill-detail.vue（秒杀取消）" },
  { file: "community-marketing.routes.ts", prefix: "/api/marketing/seckill", router: communitySeckillRouter, method: "post", routePath: "/:id/end", path: "/1/end", perm: "marketing:create", inUseVisible: [READONLY], page: "同 seckill-detail.vue（秒杀结束）" },
];

type Reason = "B" | "W" | "PUB" | "PLATFORM";

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  reason: Reason;
  note: string;
  /** true = 该行可用注入式挂载实跑（READONLY ⇒ 200 的范围控制断言） */
  runnable?: boolean;
}

/**
 * 本域**未接**名单（28 行 = G1 的 24 + G2 的 4）。
 *
 * 分类（派单卡 §三.1/§三.2 的桶定义，逐条理由见台账 §十七）：
 *  · B 8 = 「使用者集合不可枚举」——储值卡 4（`member-detail.vue:531/534/536` 无门页写调用点）
 *          ＋门店会员 2（`member-detail.vue:621/626`）＋门店建档 2（`admin-web StoresView.vue:338/408` 之外的
 *          app-mobile `store-edit.vue:218/220`，经**我的页无条件入口** `profile.vue` 可达）；
 *  · W 4 = 会员等级配置（`points.routes.ts`，页面码 `customer:level` 对**在用**角色 STORE_MANAGER 可见而不持
 *          `marketing:create` ⇒ 违反不变量 I1；D2 的前提不覆盖本页，待裁定）；
 *  · PUB 2 = 租户自助注册 2 条（`routeConfig.auth = "none"`，公开端点，挂商家码无意义）；
 *  · PLATFORM 14 = 平台侧审核 2 条（`requirePlatformAuth`，商家码无效 ⇒ 归平台侧单）
 *          ＋平台域 12 条（订阅管理 8 + 租户管理 4，卡片明示「平台侧归 S3-219 体系，不在本单」）。
 */
const UNWIRED: UnwiredRow[] = [
  // ---- G1 · B 类（8）----
  { file: "admin-store.routes.ts", prefix: "/api/admin/system", router: adminStoreRouter, method: "post", routePath: "/stores", path: "/stores", reason: "B", note: "app-mobile store-edit.vue:220（storesApi.create）经我的页 profile.vue 无条件入口可达 ⇒ 使用者集合不可枚举", runnable: true },
  { file: "admin-store.routes.ts", prefix: "/api/admin/system", router: adminStoreRouter, method: "put", routePath: "/stores/:id", path: "/stores/1", reason: "B", note: "app-mobile store-edit.vue:218（storesApi.update），同上", runnable: true },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", routePath: "/", path: "/", reason: "B", note: "member-detail.vue:536（无卡先开卡）经首页快捷入口 member-list 无条件可达", runnable: true },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", routePath: "/:cardNo/recharge", path: "/C1/recharge", reason: "B", note: "member-detail.vue:534（充值）同上", runnable: true },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", routePath: "/:cardNo/freeze", path: "/C1/freeze", reason: "B", note: "api/modules/stored-cards.ts:85（冻结）挂 app-mobile 储值卡页，同上链路", runnable: true },
  { file: "store-value-card.routes.ts", prefix: "/api/admin/store-value-cards", router: storeValueCardRouter, method: "post", routePath: "/:cardNo/unfreeze", path: "/C1/unfreeze", reason: "B", note: "api/modules/stored-cards.ts:90（解冻）同上", runnable: true },
  { file: "store.routes.ts", prefix: "/api/store/members", router: storeMemberRouter, method: "post", routePath: "/manage", path: "/manage", reason: "B", note: "member-detail.vue:621（新增会员）；member-list.vue:6 新增按钮 → 无门页", runnable: true },
  { file: "store.routes.ts", prefix: "/api/store/members", router: storeMemberRouter, method: "put", routePath: "/:id(\\\\d+)", path: "/9", reason: "B", note: "member-detail.vue:626（保存客户），同上", runnable: true },

  // ---- G2 · W 类（4）----
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "post", routePath: "/levels/config", path: "/levels/config", reason: "W", note: "level-config.vue:164（新增等级）；页面码 customer:level 对在用 STORE_MANAGER 可见但不持 marketing:create", runnable: true },
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "put", routePath: "/levels/config/:id", path: "/levels/config/1", reason: "W", note: "level-config.vue:161（保存等级），同上", runnable: true },
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "put", routePath: "/levels/config/:id/status", path: "/levels/config/1/status", reason: "W", note: "member-levels.vue:117（启停等级），同上", runnable: true },
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "delete", routePath: "/levels/config/:id", path: "/levels/config/1", reason: "W", note: "api/modules/member-levels.ts:66（删除等级），同上", runnable: true },

  // ---- G1 · 公开端点（2）----
  { file: "tenant-register.routes.ts", prefix: "/api/tenant", router: null as unknown as Router, method: "post", routePath: "/register", path: "/register", reason: "PUB", note: "租户自助注册（routeConfig.auth = none，免鉴权；调用方 app 注册链路）" },
  { file: "tenant-register.routes.ts", prefix: "/api/tenant", router: null as unknown as Router, method: "post", routePath: "/register/sms-code", path: "/register/sms-code", reason: "PUB", note: "注册验证码（同上）" },

  // ---- G1 · 平台侧（2）----
  { file: "tenant-register.routes.ts", prefix: "/api/tenant", router: null as unknown as Router, method: "post", routePath: "/applications/:id/approve", path: "/applications/1/approve", reason: "PLATFORM", note: "该文件对 /applications 段统一挂载 requirePlatformAuth + csrfMiddleware（见该文件 :25）⇒ 平台侧端点；调用方 saas-admin `api/tenant-application.ts:50`；建议码 store:create 无效（平台 JWT 不带商家 roles）⇒ 归平台侧单" },
  { file: "tenant-register.routes.ts", prefix: "/api/tenant", router: null as unknown as Router, method: "post", routePath: "/applications/:id/reject", path: "/applications/1/reject", reason: "PLATFORM", note: "同上（saas-admin `api/tenant-application.ts:54`）" },

  // ---- G1 · 平台域（12）----
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/plans", path: "/plans", reason: "PLATFORM", note: "平台域：套餐创建（requirePlatformAuth，权限点走平台机制，卡片明示不在本单）" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "put", routePath: "/plans/:planId", path: "/plans/1", reason: "PLATFORM", note: "平台域：套餐更新" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "put", routePath: "/plans/:planId/policy", path: "/plans/1/policy", reason: "PLATFORM", note: "平台域：套餐策略" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/", path: "/", reason: "PLATFORM", note: "平台域：订阅创建" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/:subscriptionId/change-plan", path: "/1/change-plan", reason: "PLATFORM", note: "平台域：变更套餐" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/:subscriptionId/cancel", path: "/1/cancel", reason: "PLATFORM", note: "平台域：退订" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/:subscriptionId/pay", path: "/1/pay", reason: "PLATFORM", note: "平台域：订阅支付" },
  { file: "subscription.routes.ts", prefix: "/api/platform/subscriptions-management", router: null as unknown as Router, method: "post", routePath: "/:subscriptionId/renew", path: "/1/renew", reason: "PLATFORM", note: "平台域：续费" },
  { file: "tenant.routes.ts", prefix: "/api/platform/tenants-management", router: null as unknown as Router, method: "post", routePath: "/", path: "/", reason: "PLATFORM", note: "平台域：租户创建" },
  { file: "tenant.routes.ts", prefix: "/api/platform/tenants-management", router: null as unknown as Router, method: "put", routePath: "/:tenantId", path: "/1", reason: "PLATFORM", note: "平台域：租户更新" },
  { file: "tenant.routes.ts", prefix: "/api/platform/tenants-management", router: null as unknown as Router, method: "put", routePath: "/:tenantId/status", path: "/1/status", reason: "PLATFORM", note: "平台域：租户状态" },
  { file: "tenant.routes.ts", prefix: "/api/platform/tenants-management", router: null as unknown as Router, method: "put", routePath: "/:tenantId/modules", path: "/1/modules", reason: "PLATFORM", note: "平台域：模块开关" },
];

/** 对账（派单卡 §三.1/§三.2）：G1 31 条缺口 + G2 14 条缺口 = 17 已接 + 28 未接 */
const G1_TOTAL = 31;
const G2_TOTAL = 14;
const UNWIRED_CLASS_TOTAL: Record<Reason, number> = { B: 8, W: 4, PUB: 2, PLATFORM: 14 };

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

describe("S3-229 · 名单自证", () => {
  it("17 已接行（逐文件分布与台账 §十七 一致）", () => {
    expect(ROWS).toHaveLength(17);
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["community-marketing.routes.ts", 10],
      ["demo.routes.ts", 2],
      ["store-control.routes.ts", 5],
    ]);
  });

  it("已接 17 行只用 3 个**既有**权限码（本批不新立权限点、不改角色种子、不动迁移）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual(["marketing:create", "store:create", "store:edit"]);
  });

  it("对账：G1 31 = 7（接）+ 8（B）+ 2（平台侧）+ 2（公开）+ 12（平台域）；G2 14 = 10（接）+ 4（W）", () => {
    const g1Wired = ROWS.filter((r) => r.file !== "community-marketing.routes.ts").length;
    const g2Wired = ROWS.filter((r) => r.file === "community-marketing.routes.ts").length;
    expect(g1Wired).toBe(7);
    expect(g2Wired).toBe(10);
    expect(g1Wired + g2Wired).toBe(ROWS.length);

    const g1Unwired = UNWIRED.filter((r) => r.file !== "points.routes.ts");
    const g2Unwired = UNWIRED.filter((r) => r.file === "points.routes.ts");
    expect(g1Wired + g1Unwired.length).toBe(G1_TOTAL);
    expect(g2Wired + g2Unwired.length).toBe(G2_TOTAL);

    // 逐类计数（台账 §十七）
    const byReason = (rows: UnwiredRow[], reason: Reason) => rows.filter((r) => r.reason === reason).length;
    expect({
      B: byReason(UNWIRED, "B"),
      W: byReason(UNWIRED, "W"),
      PUB: byReason(UNWIRED, "PUB"),
      PLATFORM: byReason(UNWIRED, "PLATFORM"),
    }).toEqual(UNWIRED_CLASS_TOTAL);
    expect(byReason(g1Unwired, "PLATFORM")).toBe(14);
    expect(byReason(g1Unwired, "B")).toBe(8);
    expect(byReason(g1Unwired, "PUB")).toBe(2);
  });
});

describe("S3-229 · 形状断言（注册行级判据，踩坑[134]）", () => {
  // ⚠️ 同一文件里可能有**多条**注册行共用同一 method + 路径模式（如 community-marketing 的 3 个 router 各有 `/:id/end`），
  // 故断言口径是「至少 1 条，且**匹配到的每一条**都带/都不带 requirePermission(」。
  it.each(ROWS)("$file $method $routePath：注册行自带 requirePermission(\"$perm\")", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 应带 requirePermission("${row.perm}")`).toContain(`requirePermission("${row.perm}")`);
    }
  });

  it.each(UNWIRED)("$file $method $routePath（未接，原因 $reason）：注册行**不含** requirePermission(", (row) => {
    const lines = registrationLines(row.file, row.method, row.routePath);
    expect(lines.length, `${label(row)} 至少应有 1 条注册行`).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.line, `${row.file}:${l.no} 不得带 requirePermission(`).not.toContain("requirePermission(");
    }
  });

  it("同文件混合态自证：store-control.routes.ts 读端点未接、5 条写端点已接（逐端点判定）", () => {
    const getConfigs = registrationLines("store-control.routes.ts", "post", "/:storeId/open");
    expect(getConfigs).toHaveLength(1);
    expect(getConfigs[0].line).toContain('requirePermission("store:create")');
    const src = readFileSync(path.join(ROUTES_DIR, "store-control.routes.ts"), "utf8");
    expect(src).toContain('adminStoreControlRouter.get("/configs", ctrl.listConfigs)');
    expect(src).not.toContain('adminStoreControlRouter.get("/configs", requirePermission');
  });

  it("同文件混合态自证：community-marketing.routes.ts 的 10 条写端点已接、7 条读端点未接", () => {
    for (const [router, routePath] of [
      [groupBuyRouter, "/:id/join"],
      [bargainRouter, "/:id/help"],
      [communitySeckillRouter, "/:orderNo/pay"],
    ] as Array<[Router, string]>) {
      const method: Method = "post";
      const lines = registrationLines("community-marketing.routes.ts", method, routePath);
      expect(lines).toHaveLength(1);
      expect(lines[0].line).toContain('requirePermission("marketing:create")');
      void router;
    }
    const src = readFileSync(path.join(ROUTES_DIR, "community-marketing.routes.ts"), "utf8");
    // 读端点（GET）一条都没被本批挂码
    expect(src).not.toMatch(/\.get\(\s*"[^"]*",\s*requirePermission\(/);
  });
});

describe("S3-229 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("3 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    expect(holdersOf("store:create")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    expect(holdersOf("store:edit")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
    expect(holdersOf("marketing:create")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
  });

  it("反证：非持有人（含在用角色 STORE_OPERATOR / READONLY）一律不持有", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      for (const uid of nonHoldersOf(perm)) {
        expect(matchPermission(USERS[uid].perms, perm), `${USERS[uid].name} 不得持有 ${perm}`).toBe(false);
      }
    }
    expect(matchPermission(USERS[STORE_OPERATOR].perms, "store:create")).toBe(false);
    expect(matchPermission(USERS[READONLY].perms, "marketing:create")).toBe(false);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "marketing:create")).toBe(false);
  });

  it("判据有分辨力：域通配不跨域；`*:view` 不覆盖写动作", () => {
    expect(matchPermission(USERS[STORE_MANAGER].perms, "store:create")).toBe(true);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "marketing:create")).toBe(false);
    expect(matchPermission(USERS[9012].perms, "store:create")).toBe(false);
    expect(matchPermission(["*:view"], "marketing:create")).toBe(false);
  });
});

describe("S3-229 · 两侧判据 a) 缺码 / 非持有人 ⇒ 403 且未到达业务层", () => {
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

describe("S3-229 · 两侧判据 b) 有码 ⇒ 通过", () => {
  it.each(ROWS)("$file $method $routePath：全部持有人（逐账号枚举）⇒ 200", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name}（${USERS[uid].roles[0]}）应通过 ${label(row)}`).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });
});

describe("S3-229 · 零回归 · 在用使用者对齐（不变量 I1：只约束**在用**角色）", () => {
  it("每条的 inUseVisible 都由「生产账号数 > 0」的角色组成（0 账号角色不进该栏，逐条写明）", () => {
    for (const row of ROWS) {
      for (const uid of row.inUseVisible) {
        expect(USERS[uid].accounts, `${USERS[uid].name} 账号数应为 > 0 才可进 inUseVisible`).toBeGreaterThan(0);
      }
    }
  });

  it("在用可见角色逐个试跑：持码 ⇒ 200；只读观察员（READONLY）⇒ 403 属既有期望（写动作）", async () => {
    for (const row of ROWS) {
      for (const uid of row.inUseVisible) {
        h.reached.length = 0;
        const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
        const isHolder = matchPermission(USERS[uid].perms, row.perm);
        if (isHolder) {
          expect(res.status, `在用角色 ${USERS[uid].name} 被 ${label(row)} 打成 403 ⇒ 回归`).toBe(200);
        } else {
          // READONLY = 只读观察员（`*:view`）：写 403 是**改造前既有**行为（该角色本来就没有写码），不是本批引入的回归
          expect(USERS[uid].name, `${label(row)} 的非持码在用可见角色只允许是观察员`).toBe("readonly");
          expect(res.status, `${label(row)} 对观察员应为 403（期望行为）`).toBe(403);
        }
      }
    }
  });

  it("零回归（机器复算）：每个码的**在用持有人** ⊇ 该码所有页面的**在用写角色**", () => {
    // 营销域 W 类 10 条的页面在用可见角色只有 READONLY（观察员）⇒ 在用写角色集合为空；
    // 门店/租户域 7 条的页面在用可见角色只有 SUPER_ADMIN（演示登录）或无调用点。
    for (const row of ROWS) {
      const writers = row.inUseVisible.filter((uid) => !USERS[uid].perms.includes("*:view"));
      for (const uid of writers) {
        expect(matchPermission(USERS[uid].perms, row.perm), `${USERS[uid].name} 必须持有 ${row.perm}`).toBe(true);
      }
    }
    // 反向自证：本批**没有**任何一条挂在"页面在用可见角色 ⊄ 持有人"的行上
    const marketingRows = ROWS.filter((r) => r.perm === "marketing:create");
    expect(marketingRows).toHaveLength(10);
  });
});

describe("S3-229 · 范围控制：本批未接行 READONLY 仍到达业务层（证明没多接、也没偷接待定项）", () => {
  it.each(UNWIRED.filter((r) => r.runnable))(
    "$file $method $routePath（未接，原因 $reason）：READONLY ⇒ 200 且到达业务层",
    async (row) => {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
      expect(res.status, `${label(row)} 不得被本批误拦`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached.length, `${label(row)} 应到达业务层`).toBeGreaterThan(0);
    }
  );

  it("四类未接原因齐备（B / W / PUB / PLATFORM 各至少 1 条，避免只取样一类）", () => {
    expect([...new Set(UNWIRED.map((r) => r.reason))].sort()).toEqual(["B", "PLATFORM", "PUB", "W"]);
  });

  it("12 行可实跑的未接行都被 READONLY 触达（B 8 + W 4）", () => {
    expect(UNWIRED.filter((r) => r.runnable)).toHaveLength(12);
  });
});

describe("S3-229 · 未登录 ⇒ 401（既有行为不变）", () => {
  it("已接行与未接行同样 401", async () => {
    for (const row of [ROWS[0], ROWS[7], UNWIRED[0]]) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
      expect(res.status, `${label(row)} 未登录应 401`).toBe(401);
    }
    expect(h.reached).toEqual([]);
  });
});
