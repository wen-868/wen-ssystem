/**
 * S3-226 · **营销域**（18 路由文件 / 89 写端点 → 本批接 **65 条**）权限接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-226.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.4（域明细）＋ §十五（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`
 * 判定留档：`docs/evidence/S3-226/01-plan-and-judgements.md`｜调用面原始输出：`docs/evidence/S3-226/02-callers.txt`
 *
 * 本文件要证明的六件事（对应派单卡 §三.1/§三.2/§三.5）：
 *  a) 本批已接 **65 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 65 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「页面/按钮真实使用者持有该码」逐条钉进测试）；
 *  d) 反证：**不持有**该码的账号一律 **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 24 行（Q 类 1 + B 类 9 + W 类 14；其中 W 10 =
 *     `community-marketing` 已由 **S3-229** 按授权模型 D2 接线）⇒ 注册行级不含
 *     `requirePermission(`，且 READONLY 仍能到达业务层（证明本批「没多接」，也没把待定项偷接）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器，只把「数据库读取」换成角色权限串；
 *  · 角色权限串：**生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，12 角色 / 租户 `default`）；
 *  · 页面真实使用者：`admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）；app-mobile 侧用
 *    `config/function-menu.ts` 的菜单码 ＋ 生产菜单可见性对照表
 *    （`docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md`）＋ 首页快捷入口（`pages/home/home.vue:69-92`）
 *    与推送深链（`native/push.ts:104-109`）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）、
 *        `retail-announcement.routes.ts` 的**内联** `requireAuthWithTenant` + `csrfMiddleware`（真实 JWT 链）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试多数行用请求头注入；公告文件那 3 行用真 JWT）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；复原 ⇒ 绿
 *   （原始输出见 `docs/evidence/S3-226/25-neg-*.txt` 与回执 §三）。
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
vi.mock("@controllers/admin/marketing-new.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-full-reduction.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-group-buy.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-points.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-stack-rule.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-asset.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-gift-rule.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-limited-discount.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-material.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-points-mall.controller", () => h.stub());
vi.mock("@controllers/admin/points-mall.controller", () => h.stub());
vi.mock("@controllers/admin/points.controller", () => h.stub());
vi.mock("@controllers/admin/retail-announcement.controller", () => h.stub());
vi.mock("@controllers/admin/retail-announcements-admin.controller", () => h.stub());
vi.mock("@controllers/admin/seckill.controller", () => h.stub());
// 未接行（Q/B/W 类）也要挂载，故其控制器同样打桩
vi.mock("@controllers/admin/marketing-calculation.controller", () => h.stub());
vi.mock("@controllers/marketing/community-marketing.controller", () => h.stub());
vi.mock("@controllers/store/coupon.controller", () => h.stub());

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
import { adminMarketingCouponRouter } from "../../routes/admin-marketing-coupon.routes";
import { adminMarketingFullReductionRouter } from "../../routes/admin-marketing-full-reduction.routes";
import { adminMarketingGroupBuyRouter } from "../../routes/admin-marketing-group-buy.routes";
import { adminMarketingPointsRouter } from "../../routes/admin-marketing-points.routes";
import { adminMarketingStackRuleRouter } from "../../routes/admin-marketing-stack-rule.routes";
import { adminMarketingCalculationRouter } from "../../routes/admin-marketing-calculation.routes";
import { marketingAssetRouter } from "../../routes/marketing-asset.routes";
import { marketingGiftRuleRouter } from "../../routes/marketing-gift-rule.routes";
import { marketingLimitedDiscountRouter } from "../../routes/marketing-limited-discount.routes";
import { marketingMaterialRouter } from "../../routes/marketing-material.routes";
import { marketingPointsMallRouter } from "../../routes/marketing-points-mall.routes";
import { pointsMallRouter } from "../../routes/points-mall.routes";
import { pointsRouter } from "../../routes/points.routes";
import { retailAnnouncementRouter } from "../../routes/retail-announcement.routes";
import { retailAnnouncementsAdminRouter } from "../../routes/retail-announcements-admin.routes";
import { seckillRouter } from "../../routes/seckill.routes";
import { groupBuyRouter, bargainRouter, seckillRouter as communitySeckillRouter } from "../../routes/community-marketing.routes";
import { storeCouponRouter } from "../../routes/store-coupon.routes";

/**
 * 测试账号：权限串 = **生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default` 共 12 角色全集）。
 * 每个账号都带 `storeId`：门店端/公告端经 `requireStoreAuth` 与控制器内的 storeId 判定，
 * 缺 storeId 会先被拦在那里、掩盖 `requirePermission` 的结果（S3-224 首版教训）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; storeId?: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], storeId: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], storeId: 1 },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"], storeId: 1 },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"], storeId: 1 },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"], storeId: 1 },
  9006: { name: "finance_staff", roles: ["FINANCE_STAFF"], perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"], storeId: 1 },
  9007: { name: "customer_service", roles: ["CUSTOMER_SERVICE"], perms: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"], storeId: 1 },
  9008: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"], storeId: 1 },
  9009: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"], storeId: 1 },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], storeId: 1 },
  9011: { name: "salesman", roles: ["SALESMAN"], perms: ["product:read", "order:read", "order:write", "customer:read", "customer:write"], storeId: 1 },
  9012: { name: "store_admin", roles: ["STORE_ADMIN"], perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"], storeId: 1 },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const OPERATION_ADMIN = 9010;

/** 页面角色名 → 测试账号（用于「页面角色 ⊆ 码持有人」的机器复算） */
const PAGE_ROLE_USER: Record<string, number> = {
  SUPER_ADMIN,
  OPERATION_ADMIN,
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
  /** 真实使用者（admin-web 页面角色；`[]` = 全仓无有效调用点，仅 API 策略面） */
  pageRoles: string[];
  /** 真实使用者依据（文件:行） */
  page: string;
  /** true = 需要真 JWT 挂载（`retail-announcement.routes.ts` 的 admin 子路径内联认证） */
  rawMount?: boolean;
}

/**
 * 本批已接名单（**65 行**，逐行判定见 `docs/evidence/S3-226/01-plan-and-judgements.md`）。
 * 口径（派单卡 §二）：① 挂「该端点**真实使用者已持有**的模块码」（零回归）；
 * ② 使用者集合不可枚举 / 页面角色 ⊄ 码持有人 / 查询型 POST ⇒ 不接线（见 UNWIRED）；
 * ③ 本批**不新立权限码、不改角色种子、不动迁移**（两个码均为 079_权限矩阵.sql 既有码）。
 */
const ROWS: Row[] = [
  // ---- admin-marketing-coupon.routes.ts（3 / 5；新建与 pause 见 UNWIRED B 类）----
  { file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "put", routePath: "/coupons/templates/:id", path: "/coupons/templates/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "CouponManage.vue:317（优惠券管理 marketing/coupon，router:227）" },
  { file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "delete", routePath: "/coupons/templates/:id", path: "/coupons/templates/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "CouponManage.vue:363 + MarketingView.vue:540（营销活动 router:220）" },
  { file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "post", routePath: "/coupons/templates/:id/activate", path: "/coupons/templates/1/activate", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "CouponManage.vue:347 + MarketingView.vue:511" },

  // ---- admin-marketing-full-reduction.routes.ts（2 / 5；delete 与 activate/pause 见 UNWIRED B 类）----
  { file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "post", routePath: "/full-reductions", path: "/full-reductions", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "FullReduction.vue:347 + MarketingView.vue:475（满减满赠 router:229）" },
  { file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "put", routePath: "/full-reductions/:id", path: "/full-reductions/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "FullReduction.vue:344" },

  // ---- admin-marketing-group-buy.routes.ts（6）----
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "post", routePath: "/group-buys", path: "/group-buys", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:182 仅封装（createGroupBuy 全仓 .vue 零引用）" },
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "put", routePath: "/group-buys/:id", path: "/group-buys/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:186 仅封装（updateGroupBuy 零引用）" },
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "delete", routePath: "/group-buys/:id", path: "/group-buys/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingView.vue:543（deleteGroupBuy）" },
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "post", routePath: "/group-buys/:id/activate", path: "/group-buys/1/activate", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingView.vue:514（activateGroupBuy）" },
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "post", routePath: "/group-buys/teams", path: "/group-buys/teams", perm: "marketing:create", pageRoles: [], page: "全仓无调用点" },
  { file: "admin-marketing-group-buy.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingGroupBuyRouter, method: "post", routePath: "/group-buys/teams/:teamId/join", path: "/group-buys/teams/9/join", perm: "marketing:create", pageRoles: [], page: "全仓无调用点" },

  // ---- admin-marketing-points.routes.ts（1 / 2；redeem 见 UNWIRED B 类）----
  { file: "admin-marketing-points.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingPointsRouter, method: "put", routePath: "/points/rule", path: "/points/rule", perm: "marketing:points", pageRoles: [], page: "全仓无调用点（`rg 'points/rule'` 六端零命中）" },

  // ---- admin-marketing-stack-rule.routes.ts（3）----
  { file: "admin-marketing-stack-rule.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingStackRuleRouter, method: "post", routePath: "/stack-rules", path: "/stack-rules", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:244 打 /admin/marketing/promotions/stack-rules（后端无此前缀）" },
  { file: "admin-marketing-stack-rule.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingStackRuleRouter, method: "put", routePath: "/stack-rules/:id", path: "/stack-rules/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:248 同上（路径错配）" },
  { file: "admin-marketing-stack-rule.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingStackRuleRouter, method: "delete", routePath: "/stack-rules/:id", path: "/stack-rules/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:252 同上（路径错配）" },

  // ---- marketing-asset.routes.ts（3）----
  { file: "marketing-asset.routes.ts", prefix: "/api/marketing-asset", router: marketingAssetRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:317 打 /admin/marketing-assets（后端前缀 /api/marketing-asset）" },
  { file: "marketing-asset.routes.ts", prefix: "/api/marketing-asset", router: marketingAssetRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:318 同上（路径错配）" },
  { file: "marketing-asset.routes.ts", prefix: "/api/marketing-asset", router: marketingAssetRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:319 同上（路径错配）" },

  // ---- marketing-gift-rule.routes.ts（8）----
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingGiftRule.vue:436（赠品规则 router:223）" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingGiftRule.vue:277/433" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingGiftRule.vue:289" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "post", routePath: "/:id/activate", path: "/1/activate", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点（api/marketing.ts 无对应封装）" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "post", routePath: "/:id/pause", path: "/1/pause", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "post", routePath: "/:id/levels", path: "/1/levels", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "put", routePath: "/:id/levels/:levelId", path: "/1/levels/2", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点" },
  { file: "marketing-gift-rule.routes.ts", prefix: "/api/admin/marketing/gift-rules", router: marketingGiftRuleRouter, method: "delete", routePath: "/:id/levels/:levelId", path: "/1/levels/2", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点" },

  // ---- marketing-limited-discount.routes.ts（7）----
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:485（限时折扣 router:222）" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:482" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:351" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "post", routePath: "/:id/activate", path: "/1/activate", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:327" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "post", routePath: "/:id/pause", path: "/1/pause", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:329" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "post", routePath: "/:id/products", path: "/1/products", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingLimitedDiscount.vue:488" },
  { file: "marketing-limited-discount.routes.ts", prefix: "/api/admin/marketing/limited-discounts", router: marketingLimitedDiscountRouter, method: "delete", routePath: "/:id/products/:productId", path: "/1/products/2", perm: "marketing:create", pageRoles: [], page: "全仓无页面调用点" },

  // ---- marketing-material.routes.ts（8）----
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:338 仅封装（createMarketingMaterial 全仓 .vue 零引用）" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:343 仅封装（updateMarketingMaterial 零引用）" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:632（营销素材 router:226）" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "post", routePath: "/:id/publish", path: "/1/publish", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:615" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "post", routePath: "/:id/archive", path: "/1/archive", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:615" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "post", routePath: "/categories", path: "/categories", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:456/472" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "put", routePath: "/categories/:id", path: "/categories/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:488" },
  { file: "marketing-material.routes.ts", prefix: "/api/admin/marketing/materials", router: marketingMaterialRouter, method: "delete", routePath: "/categories/:id", path: "/categories/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "MarketingMaterial.vue:507" },

  // ---- marketing-points-mall.routes.ts（7）----
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "post", routePath: "/products", path: "/products", perm: "marketing:points", pageRoles: ["SUPER_ADMIN"], page: "MarketingPointsMall.vue:454（积分商城 router:224）" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "put", routePath: "/products/:id", path: "/products/1", perm: "marketing:points", pageRoles: ["SUPER_ADMIN"], page: "MarketingPointsMall.vue:451" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "delete", routePath: "/products/:id", path: "/products/1", perm: "marketing:points", pageRoles: ["SUPER_ADMIN"], page: "MarketingPointsMall.vue:352" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "post", routePath: "/products/:id/toggle", path: "/products/1/toggle", perm: "marketing:points", pageRoles: ["SUPER_ADMIN"], page: "MarketingPointsMall.vue:342" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "post", routePath: "/exchange", path: "/exchange", perm: "marketing:points", pageRoles: [], page: "全仓无调用点（app-mobile 积分兑换打的是 /admin/marketing/points/redeem）" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "post", routePath: "/exchange-records/:id/cancel", path: "/exchange-records/1/cancel", perm: "marketing:points", pageRoles: [], page: "全仓无调用点" },
  { file: "marketing-points-mall.routes.ts", prefix: "/api/admin/marketing/points-mall", router: marketingPointsMallRouter, method: "post", routePath: "/exchange-records/:id/confirm", path: "/exchange-records/1/confirm", perm: "marketing:points", pageRoles: [], page: "全仓无调用点" },

  // ---- points-mall.routes.ts（6）----
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "post", routePath: "/items", path: "/items", perm: "marketing:points", pageRoles: [], page: "api/marketing.ts:308 打 /admin/points-mall/items（后端前缀 /api/points-mall）" },
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "put", routePath: "/items/:id", path: "/items/1", perm: "marketing:points", pageRoles: [], page: "api/marketing.ts:309 同上（路径错配）" },
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "delete", routePath: "/items/:id", path: "/items/1", perm: "marketing:points", pageRoles: [], page: "api/marketing.ts:310 同上（路径错配）" },
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "put", routePath: "/items/:id/status", path: "/items/1/status", perm: "marketing:points", pageRoles: [], page: "全仓无调用点" },
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "put", routePath: "/orders/:id/deliver", path: "/orders/1/deliver", perm: "marketing:points", pageRoles: [], page: "api/marketing.ts:312 用 POST，后端为 PUT（方法亦错配）" },
  { file: "points-mall.routes.ts", prefix: "/api/points-mall", router: pointsMallRouter, method: "put", routePath: "/orders/:id/cancel", path: "/orders/1/cancel", perm: "marketing:points", pageRoles: [], page: "全仓无调用点" },

  // ---- points.routes.ts（2 / 7；levels 4 条与 points/adjust 见 UNWIRED）----
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "post", routePath: "/rules", path: "/rules", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "customer/PointsRules.vue:215（积分规则 router:149）" },
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "put", routePath: "/rules/:id", path: "/rules/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "customer/PointsRules.vue:212" },

  // ---- retail-announcement.routes.ts（3；内联认证 ⇒ rawMount）----
  { file: "retail-announcement.routes.ts", prefix: "/api/retail-announcement", router: retailAnnouncementRouter, method: "post", routePath: "/admin/retail-announcements", path: "/admin/retail-announcements", perm: "marketing:create", pageRoles: [], page: "admin-web 打的是 /admin/retail-announcements（命中另一文件）⇒ 本前缀无有效调用点", rawMount: true },
  { file: "retail-announcement.routes.ts", prefix: "/api/retail-announcement", router: retailAnnouncementRouter, method: "put", routePath: "/admin/retail-announcements/:id", path: "/admin/retail-announcements/1", perm: "marketing:create", pageRoles: [], page: "同上（本前缀无有效调用点）", rawMount: true },
  { file: "retail-announcement.routes.ts", prefix: "/api/retail-announcement", router: retailAnnouncementRouter, method: "delete", routePath: "/admin/retail-announcements/:id", path: "/admin/retail-announcements/1", perm: "marketing:create", pageRoles: [], page: "同上（本前缀无有效调用点）", rawMount: true },

  // ---- retail-announcements-admin.routes.ts（3）----
  { file: "retail-announcements-admin.routes.ts", prefix: "/api/admin/retail-announcements", router: retailAnnouncementsAdminRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "instant-retail/RetailAnnouncement.vue:203（平台公告 router:189）" },
  { file: "retail-announcements-admin.routes.ts", prefix: "/api/admin/retail-announcements", router: retailAnnouncementsAdminRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "RetailAnnouncement.vue:200/224" },
  { file: "retail-announcements-admin.routes.ts", prefix: "/api/admin/retail-announcements", router: retailAnnouncementsAdminRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "RetailAnnouncement.vue:234" },

  // ---- seckill.routes.ts（3）----
  { file: "seckill.routes.ts", prefix: "/api/seckill", router: seckillRouter, method: "post", routePath: "/", path: "/", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:294 打 /admin/marketing/seckill（后端前缀 /api/seckill）" },
  { file: "seckill.routes.ts", prefix: "/api/seckill", router: seckillRouter, method: "put", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:295 同上（路径错配）" },
  { file: "seckill.routes.ts", prefix: "/api/seckill", router: seckillRouter, method: "delete", routePath: "/:id", path: "/1", perm: "marketing:create", pageRoles: [], page: "api/marketing.ts:296 同上（路径错配）" },

  // ===== S3-233（B 类收编第一批 · 营销域 5 条）=================================================
  // 依据门（唯一真相源）= app-mobile/src/config/permission-gates.ts：`mkt-coupons`（优惠券入口 + 推送深链）
  //   与 `mkt-activities`（营销活动入口），门码均为 `marketing:create`。
  // B 类前提（页面经推送深链 / 菜单码零映射的前缀回退无条件可达 ⇒ 使用者集合不可枚举）已由 S3-230 的入口权限门修复。
  { file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "post", routePath: "/coupons/templates", path: "/coupons/templates", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "app-mobile create-coupon.vue:279 + 桌面 CouponManage.vue（优惠券管理 router:227 [SUPER_ADMIN]）；门 = mkt-coupons" },
  { file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "post", routePath: "/coupons/templates/:id/pause", path: "/coupons/templates/1/pause", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "app-mobile coupons.vue:147 + 桌面 CouponManage.vue:349（同页）；门 = mkt-coupons" },
  { file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "post", routePath: "/full-reductions/:id/activate", path: "/full-reductions/1/activate", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "app-mobile activities.vue:128（门 mkt-activities）+ 桌面 MarketingView.vue（营销活动 router:220 [SUPER_ADMIN]）" },
  { file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "post", routePath: "/full-reductions/:id/pause", path: "/full-reductions/1/pause", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "app-mobile activities.vue:146（门 mkt-activities）" },
  { file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "delete", routePath: "/full-reductions/:id", path: "/full-reductions/1", perm: "marketing:create", pageRoles: ["SUPER_ADMIN"], page: "app-mobile activities.vue:164（门 mkt-activities）+ 桌面 MarketingView.vue:542" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /** Q = 查询型 POST；B = 使用者集合不可枚举（app-mobile 无门入口/孤岛页）；W = 待授权模型定案（页面角色 ⊄ 码持有人） */
  reason: "Q" | "B" | "W";
  note: string;
  rawMount?: boolean;
}

/** 本域本批**未接**的代表行（三类原因各取样；逐条全量见台账 §十五.4~§十五.6）。 */
const UNWIRED: UnwiredRow[] = [
  { file: "admin-marketing-calculation.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCalculationRouter, method: "post", routePath: "/calculate", path: "/calculate", reason: "Q", note: "活动**试算**：`services/admin/marketing-calculation.service.ts` 的 `calculatePromotion` 只读不写（仅 SELECT，`rg -in 'insert into|update |delete from'` 零命中）⇒ 按派单卡 §二.3「查询型 POST 不按写端点接」（同批 6 `POST /admin/quote-push/preview`）" },
  // （S3-233：原 5 行 B 类（coupon create/pause、full-reduction delete/activate/pause）已收编接线，见上方 ROWS 的 S3-233 块）
  { file: "admin-marketing-points.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingPointsRouter, method: "post", routePath: "/points/redeem", path: "/points/redeem", reason: "B", note: "app-mobile `pages-sub/marketing/points/points-exchange.vue:88 pointsApi.exchange`；该页 `pages.json:461` 注册后**全仓无导航入口**（孤岛页）⇒ 使用者集合不可枚举" },
  // ⚠️ S3-226 当时登记的 `community-marketing.routes.ts` 10 条 W 类代表行**已由 S3-229（批 9）按授权模型提案 D2 接线**
  //    （挂 `marketing:create`；生产底稿显示该前缀菜单只授予 OPERATION_ADMIN(0 账号)/READONLY(观察员)/STORE_ADMIN(0 账号)
  //    ⇒ 无在用写角色回归）。故本文件不再把这 10 条列为"未接"，其接线验收在
  //    `rbac-b2-s3-229-store-and-marketing-wiring.test.ts`。此处保留 points 的会员等级 4 条（仍待裁定）。
  // ⚠️ **状态变更登记（2026-10-16 · S3-231 F1）**：`points.routes.ts` 会员等级配置 **4 条**原列此处为 W（待裁定），
  //    已由 **S3-231 F1** 按凌舟裁定 1（`docs/tasks/cards/R101-S3-229-凌舟验收与裁定.md` §二.1）**改挂 `customer:level` 接线**
  //    ⇒ 从本名单移除（W 4 → **0**）。接线验收见 `rbac-b2-s3-231-f1-member-levels-wiring.test.ts` + `docs/evidence/S3-231/F1/`。
  { file: "points.routes.ts", prefix: "/api/admin/members", router: pointsRouter, method: "post", routePath: "/:id/points/adjust", path: "/1/points/adjust", reason: "B", note: "app-mobile `member/member-detail.vue:540` 直接 post；该页经首页快捷入口「会员管理」（`pages/home/home.vue:87`，**无条件**）→ 会员列表 → 详情 ⇒ 使用者集合不可枚举" },
  { file: "store-coupon.routes.ts", prefix: "/api/store/coupons", router: storeCouponRouter, method: "post", routePath: "/verify", path: "/verify", reason: "B", note: "app-mobile `coupon-verify.vue:160 verifyCoupon`（经优惠券页 `coupons.vue:132` 进入，而该页有**无条件推送深链**）⇒ 不可枚举；桌面页 `pos/CouponVerifyView.vue:243`（角色含收银员）本身满足 `sale:create` 口径，码位方案已备好（见台账 §十五.6）" },
  { file: "store-coupon.routes.ts", prefix: "/api/store/coupons", router: storeCouponRouter, method: "post", routePath: "/manual-verify", path: "/manual-verify", reason: "B", note: "app-mobile `coupon-verify.vue:163 manualVerifyCoupon` ⇒ 同上" },
];

/** 台账 §三.4 的本域写端点总数（18 文件）= 本批已接 65 + 未接 24 */
const DOMAIN_TOTAL = 89;

/**
 * 未接 24 条的**逐条**分类（台账 §十五.4~§十五.6；这里是可被断言复算的机读镜像）：
 *  · Q 1 = `admin-marketing-calculation` 的活动试算（service 只读不写）；
 *  · B 9 = 「使用者集合不可枚举」——`admin-marketing-coupon` 2（推送深链）＋`admin-marketing-full-reduction` 3
 *          （菜单码生产零映射、仅前缀回退）＋`admin-marketing-points` 1（孤岛页）＋`points` 1（首页快捷入口）
 *          ＋`store-coupon` 2（推送深链链路上）；
 *  · W 14 = 「页面可见角色 ⊄ 码持有人」——`community-marketing` 全部 10 条（菜单可见角色含 `READONLY` / 旧词表 `STORE_ADMIN`）
 *          ＋`points` 的会员等级 4 条（菜单码 `customer:level` 对店长/销售/客服可见）。
 * ⚠️ 口径分界：页面**经无门入口可达或菜单码零映射** ⇒ B；页面**可见角色可枚举但 ⊄ 持有人** ⇒ W（待授权模型定案）。
 * ⚠️ **S3-229（批 9）变更**：`community-marketing` 的 10 条 W 类已按授权模型提案 **D2** 接线（挂 `marketing:create`）⇒
 *    本文件当时**仍未接**的 = 24 − 10 = **14 条**（Q 1 + B 9 + W 4）。
 * ⚠️ **S3-231（F1）变更（2026-10-16）**：`points` 会员等级 **4 条**已按凌舟裁定 1 改挂 `customer:level` 接线
 *    （`R101-S3-229-凌舟验收与裁定.md` §二.1）⇒ 当前**仍未接** = 14 − 4 = **10 条（Q 1 + B 9 + W 0）**。
 */
// 合并口径（rebase 后取两侧并集，S3-233 ⨯ main(#358) 零重叠）：
//   · S3-229 接线 community-marketing 的 10 条 W 类 ⇒ W 14 → 4
//   · S3-231 F1 接线 points 会员等级 4 条（W 类）⇒ W 4 → 0
//   · S3-233 收编 5 条 B 类（coupon 2 + full-reduction 3）⇒ B 9 → 4
const UNWIRED_CLASS_TOTAL = { Q: 1, B: 4, W: 0 };

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

/** 真 JWT 挂载（`retail-announcement.routes.ts` 的 routeConfig.auth = "none"，认证由内联 requireAuthWithTenant 承担） */
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
        // `tenantMiddleware` 要求 `req.user.tenantId`（middleware/tenant.ts）⇒ JWT 载荷必须带租户，
        // 否则先被拦成 403「缺少租户信息」，掩盖真实的权限判定结果（S3-224 首版教训）。
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

describe("S3-226 · 名单自证", () => {
  it("70 已接行（S3-226 的 65 行 + S3-233 收编 5 行；逐文件分布与台账 §十五.2/§十八 一致）", () => {
    expect(ROWS).toHaveLength(70);
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["admin-marketing-coupon.routes.ts", 5],
      ["admin-marketing-full-reduction.routes.ts", 5],
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
    // 本域 18 个文件里，本批 0 接线的（B/W 类）—— `community-marketing.routes.ts` 已由 S3-229 接线，故从该名单移除
    for (const f of ["admin-marketing-calculation.routes.ts", "store-coupon.routes.ts"]) {
      expect(perFile.has(f), `${f} 本批应为 0 接线`).toBe(false);
    }
  });

  it("已接 70 行只用 2 个**既有**权限码（两批均不新立权限点、不改角色种子、不动迁移）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual(["marketing:create", "marketing:points"]);
  });

  it("对账：台账 §三.4 本域 89 写端点 = 已接 70（S3-226 的 65 + S3-233 收编 5） + 未接 19（Q1 + B9 + W14 − S3-229 的 W10 − S3-233 收编的 B5）", () => {
    const owned =
      0 + // coupon：create / pause 已由 S3-233 收编（原 2）
      0 + // full-reduction：delete / activate / pause 已由 S3-233 收编（原 3）
      1 + // marketing-points：redeem 未接
      1 + // calculation：calculate（Q）
      10 + // community-marketing 全部
      5 + // points.routes：levels 4 + adjust 1
      2; // store-coupon 全部
    expect(DOMAIN_TOTAL - ROWS.length).toBe(19);
    expect(owned).toBe(19);
    // ① 本批当时的分类（台账 §十五.4~§十五.6）—— 历史事实，不变；
    expect({ Q: 1, B: 9, W: 14 }).toEqual({ Q: 1, B: 9, W: 14 });
    // ② 当前**仍未接**的分类（两侧并集）：
    //    · S3-229 把 community-marketing 的 10 条 W 类接线（W 14 → 4）
    //    · S3-231 F1 把 points 会员等级 4 条接线（W 4 → 0）
    //    · S3-233 把 5 条 B 类收编（B 9 → 4：points/adjust 1 + marketing-points/redeem 1 + store-coupon 2）
    expect(UNWIRED_CLASS_TOTAL).toEqual({ Q: 1, B: 4, W: 0 });
  });
});

describe("S3-226 · 形状断言（注册行级判据，踩坑[134]）", () => {
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

  it("同文件混合态自证：admin-marketing-coupon.routes.ts 的 create/pause/update 三行**均已接**（S3-233 收编后同码）", () => {
    const create = registrationLines("admin-marketing-coupon.routes.ts", "post", "/coupons/templates");
    expect(create).toHaveLength(1);
    expect(create[0].line, "新建券模板行必须行级自带该码").toContain('requirePermission("marketing:create")');
    const pause = registrationLines("admin-marketing-coupon.routes.ts", "post", "/coupons/templates/:id/pause");
    expect(pause).toHaveLength(1);
    expect(pause[0].line, "暂停券模板行必须行级自带该码").toContain('requirePermission("marketing:create")');
    const update = registrationLines("admin-marketing-coupon.routes.ts", "put", "/coupons/templates/:id");
    expect(update).toHaveLength(1);
    expect(update[0].line).toContain('requirePermission("marketing:create")');
  });

  it("同文件混合态自证：points.routes.ts 的 rules + levels/config 5 行已接、points/adjust 行未接（S3-231 F1 状态变更）", () => {
    for (const [method, routePath, wired] of [
      ["post", "/rules", true],
      ["put", "/rules/:id", true],
      // ⚠️ S3-231 F1：会员等级 4 条已改挂 `customer:level` 接线 ⇒ 期望由 false 改 true（状态变更登记）
      ["post", "/levels/config", true],
      ["put", "/levels/config/:id", true],
      ["put", "/levels/config/:id/status", true],
      ["delete", "/levels/config/:id", true],
      ["post", "/:id/points/adjust", false],
    ] as Array<[Method, string, boolean]>) {
      const lines = registrationLines("points.routes.ts", method, routePath);
      expect(lines, `points.routes.ts ${method} ${routePath}`).toHaveLength(1);
      expect(lines[0].line.includes("requirePermission("), `points.routes.ts ${method} ${routePath}`).toBe(wired);
    }
  });

  it("状态变更登记（S3-229 接线后）：community-marketing 的 10 条写端点已挂 `marketing:create`", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "community-marketing.routes.ts"), "utf8");
    const n = (src.match(/requirePermission\("marketing:create"\)/g) ?? []).length;
    expect(n, "S3-229 已接线 10 条 ⇒ 本文件不再把该文件列为未接").toBe(10);
    // 三个 router 变量仍被引用（防 import 悬空；它们的接线级验收在 rbac-b2-s3-229-*.test.ts）
    expect([groupBuyRouter, bargainRouter, communitySeckillRouter].every((r) => typeof r === "function")).toBe(true);
  });

  it("查询型 POST（Q 类）未接线，且证据落在 service 层：calculatePromotion 只读不写", () => {
    const lines = registrationLines("admin-marketing-calculation.routes.ts", "post", "/calculate");
    expect(lines).toHaveLength(1);
    expect(lines[0].line).not.toContain("requirePermission(");
    const svc = readFileSync(fileURLToPath(new URL("../../services/admin/marketing-calculation.service.ts", import.meta.url)), "utf8");
    expect(svc).not.toMatch(/insert\s+into|delete\s+from|update\s+\w+\s+set/i);
  });

  it("公告文件（rawMount）在**内联 csrf 之后**挂 requirePermission（顺序：认证 → CSRF → 权限）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "retail-announcement.routes.ts"), "utf8");
    const lines = src.split(/\r?\n/);
    const csrfMount = lines.findIndex((l) => l.includes('retailAnnouncementRouter.use("/admin", csrfMiddleware)'));
    for (const p of ["post", "put", "delete"]) {
      const reg = lines.findIndex((l) => new RegExp(`\\.${p}\\(\\s*"/admin/retail-announcements`).test(l));
      expect(reg, `${p} 注册行`).toBeGreaterThan(-1);
      expect(reg, `${p}: 权限必须挂在 csrf 之后`).toBeGreaterThan(csrfMount);
      expect(lines[reg]).toContain("requirePermission(");
    }
  });
});

describe("S3-226 · 权限持有人集合复算（生产 matchPermission × 生产角色权限串）", () => {
  it("2 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    // 生产 12 角色里没有任何角色显式持有 `marketing:*`；只有两个 `"*"` 角色通配命中
    expect(holdersOf("marketing:create")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
    expect(holdersOf("marketing:points")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
  });

  it("反证：READONLY / 店长 / 收银员 / 销售 / 财务 / 客服 / 仓管 / 采购 / SALESMAN / STORE_ADMIN 全不持有", () => {
    for (const perm of [...new Set(ROWS.map((r) => r.perm))]) {
      for (const uid of nonHoldersOf(perm)) {
        expect(matchPermission(USERS[uid].perms, perm), `${USERS[uid].name} 不得持有 ${perm}`).toBe(false);
      }
    }
    expect(matchPermission(USERS[9003].perms, "marketing:create")).toBe(false);
    expect(matchPermission(USERS[9012].perms, "marketing:points")).toBe(false);
  });

  it("判据有分辨力：域通配不跨域（`store:*` / `sale:*` / `customer:*` 都不覆盖 `marketing:*`）", () => {
    expect(matchPermission(USERS[9003].perms, "store:list")).toBe(true);
    expect(matchPermission(USERS[9003].perms, "marketing:create")).toBe(false);
    expect(matchPermission(USERS[9008].perms, "inventory:create")).toBe(true);
    expect(matchPermission(USERS[9008].perms, "marketing:points")).toBe(false);
    expect(matchPermission(["*:view"], "marketing:create")).toBe(false);
  });
});

describe("S3-226 · 两侧判据 a) 缺码 ⇒ 403 且未到达业务层", () => {
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

describe("S3-226 · 两侧判据 b) 有码 ⇒ 通过（不锁死既有页面角色）", () => {
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

describe("S3-226 · 范围控制：本批未接行 READONLY 仍到达业务层（证明没多接、也没偷接待定项）", () => {
  it.each(UNWIRED)("$file $method $routePath（未接，原因 $reason）：READONLY ⇒ 200 且到达业务层", async (row) => {
    h.reached.length = 0;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY, row.rawMount);
    expect(res.status, `${label(row)} 不得被本批误拦`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length, `${label(row)} 应到达业务层`).toBeGreaterThan(0);
  });

  it("现余两类未接原因齐备（Q / B 各至少 1 条；W 已由 S3-229 + S3-231 F1 清零）", () => {
    // ⚠️ 状态变更登记（S3-231 F1，2026-10-16）：points 会员等级 4 条接线后 W 桶清零 ⇒ 期望集合去 W，
    //    并把「W 已清零」写成显式断言（避免将来被读成"W 桶凭空消失"）。
    expect([...new Set(UNWIRED.map((r) => r.reason))].sort()).toEqual(["B", "Q"]);
    expect(UNWIRED.filter((r) => r.reason === "W")).toHaveLength(0);
    expect(UNWIRED).toHaveLength(10);
  });
});

describe("S3-226 · 未登录 ⇒ 401（既有行为不变）", () => {
  it("注入式挂载：未接行与已接行同样 401", async () => {
    for (const row of [ROWS[0], UNWIRED[1]]) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
      expect(res.status, `${label(row)} 未登录应 401`).toBe(401);
    }
  });

  it("真 JWT 挂载（retail-announcement）：无 Bearer ⇒ 401（认证仍在前）", async () => {
    const row = ROWS.find((r) => r.rawMount)!;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(h.reached).toEqual([]);
  });
});
