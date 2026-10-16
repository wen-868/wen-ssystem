/**
 * S3-220 · **商品域**（10 路由文件 / 45 写端点）权限接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-220.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.3（域明细）＋ §十二（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 573 条 / 146 文件）
 * 基线：`origin/main` = 本单开工时 `11f4af48`（见回执 §三）
 *
 * 本文件要证明的六件事（对应派单卡 §三）：
 *  a) 本批已接 **15 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调这 15 行 ⇒ **403**，且**未到达业务层**；
 *  c) 该码的**持有账号**调对应行 ⇒ **200**（零回归：把「真实使用者持有该码」逐条钉在测试里）；
 *  d) 反证：**不持有**该码的账号一律 **403**（判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域本批**未接**的 30 行 ⇒ READONLY 与既有行为一致（其中 2 条价格端点属既有
 *     「待裁定/已知锁定」项，拦在前面的仍是 price-guard），且注册行级不含 `requirePermission(`
 *     （证明「没多接」，也没把待定项偷接）；
 *  f) 未登录 ⇒ 401（既有行为不变）。
 *
 * 判据来源（逐条可核对）：
 *  · 权限匹配语义：`services/admin/rbac.service.ts` 的 `matchPermission`（`*` / `dom:*` / `*:action` / 精确码），
 *    测试用**生产同一份**匹配器（只把数据库读取换成角色权限串）；
 *  · 角色权限串：**生产只读导出**（`docs/evidence/S3-220/00-prod-roles-raw.txt`，
 *    由 `tools/prod-roles-dump.sh` 经服务器只读通道取得；持有关系复算见 `tools/prod-holders.mjs`）
 *    —— 含仓库种子（079/128/ops-S3-122*）里没有的 `STORE_ADMIN` / `SALESMAN`；
 *  · 页面真实使用者：`admin-web/src/router/index.ts:165-178`（桌面 `meta.roles` fail-closed）＋
 *    `app-mobile/src/config/function-menu.ts:43-53`（移动菜单码）＋ `app-mobile/src/pages.json` 的
 *    **无门 tab 页**（`pages/products/products` 商品 tab ⇒ 商品详情/编辑/扫码写调用点不可判定）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体（`middleware/rbac-auth.ts`）、
 *        `matchPermission` 匹配器、`price-guard` 的 `requirePriceManagementAccess`/`priceResponseFilter` 本体、
 *        CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器（只记录「请求是否到达
 *        业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉本批任一条 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 *   复原 ⇒ 绿（原始输出见 `docs/evidence/S3-220/` 反测日志与回执 §五）。
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
  /** userId → 角色权限串（等价于 t_sys_role.permissions，取**生产真值**） */
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
vi.mock("@controllers/admin/library.controller", () => h.stub());
vi.mock("@controllers/admin/library-copy.controller", () => h.stub());
vi.mock("@controllers/admin/product.controller", () => h.stub());
vi.mock("@controllers/admin/product-image.controller", () => h.stub());
vi.mock("@controllers/admin/stock-warning.controller", () => h.stub());
vi.mock("@controllers/admin/category.controller", () => h.stub());
vi.mock("@controllers/admin/brand.controller", () => h.stub());
vi.mock("@controllers/admin/price-level.controller", () => h.stub());
vi.mock("@controllers/admin/price-management.controller", () => h.stub());
vi.mock("@controllers/admin/batch-price.controller", () => h.stub());
vi.mock("@controllers/admin/price-review.controller", () => h.stub());
vi.mock("@controllers/admin/product-bundle.controller", () => h.stub());
vi.mock("@controllers/admin/combo-product.controller", () => h.stub());
vi.mock("@controllers/admin/product-review.controller", () => h.stub());
vi.mock("@controllers/admin/product-marketing-tag.controller", () => h.stub());
vi.mock("@controllers/admin/unit-group.controller", () => h.stub());
vi.mock("@controllers/admin/unit.controller", () => h.stub());

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
import { adminLibraryRouter } from "../../routes/admin-library.routes";
import { adminProductRouter } from "../../routes/admin-product.routes";
import { brandRouter } from "../../routes/brand.routes";
import { categoryRouter } from "../../routes/category.routes";
import { priceRouter } from "../../routes/price.routes";
import { productBundleRouter } from "../../routes/product-bundle.routes";
import { productMarketingTagRouter } from "../../routes/product-marketing-tag.routes";
import { productReviewRouter } from "../../routes/product-review.routes";
import { unitGroupRouter } from "../../routes/unit-group.routes";
import { unitRouter } from "../../routes/unit.routes";

/**
 * 测试账号：权限串取**生产只读导出**（`docs/evidence/S3-220/00-prod-roles-raw.txt`，
 * `tenant_id='default'` 的 12 个角色，逐条可核对），与 `tools/prod-holders.mjs` 复算口径同源。
 * 相比批 1/批 2 的账号集，本文件**补上了生产真实存在、仓库种子里没有**的两个角色：
 * `STORE_ADMIN`（product:read/order:read/order:write/inventory:read/inventory:write）与
 * `SALESMAN`（product:read、order:read、order:write、customer:read、customer:write）
 * —— 它们同样**不持**任何 goods 写码。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[] }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"] },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"] },
  9010: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"] },
  9009: {
    name: "store_manager",
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
  9013: {
    name: "store_operator",
    roles: ["STORE_OPERATOR"],
    perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  },
  9012: {
    name: "sales_staff",
    roles: ["SALES_STAFF"],
    perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  },
  9007: {
    name: "purchase_staff",
    roles: ["PURCHASE_STAFF"],
    perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"],
  },
  9011: {
    name: "warehouse_staff",
    roles: ["WAREHOUSE_STAFF"],
    perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"],
  },
  9006: {
    name: "finance_staff",
    roles: ["FINANCE_STAFF"],
    perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
  },
  9014: {
    name: "store_admin",
    roles: ["STORE_ADMIN"],
    perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"],
  },
  9015: {
    name: "salesman",
    roles: ["SALESMAN"],
    perms: ["product:read", "order:read", "order:write", "customer:read", "customer:write"],
  },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;
const OPERATION_ADMIN = 9010;
const STORE_MANAGER = 9009;
const STORE_OPERATOR = 9013;
const SALES_STAFF = 9012;
const WAREHOUSE_STAFF = 9011;
const FINANCE_STAFF = 9006;
const STORE_ADMIN = 9014;
const SALESMAN = 9015;

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
 * 已接名单（**27 行** = S3-220 的 15 行 + S3-233 收编的 12 行，逐行判定见台账 §十二 / §十八）。
 * 口径（派单卡 §二）：① 优先挂「该端点真实使用者已持有的模块码」（零回归）；
 * ② 只有「商品岗专属、且使用者本来就不是门店/仓管/财务」的端点才挂 `goods:*`；
 * ③ 找不到使用者已持有码 ⇒ 不接线（见 UNWIRED）。
 *
 * 生产持有事实（`tools/prod-holders.mjs`）：`goods:create` / `goods:edit` / `goods:delete`
 * **仅** `SUPER_ADMIN` + `OPERATION_ADMIN` 持有（都靠 `"*"`）；`goods:price` 另加 `STORE_MANAGER`。
 */
const ROWS: Row[] = [
  // ---- admin-product.routes.ts（3）：三行**均无有效页面调用点** ----
  //   :status  —— 桌面 Products.vue:1051 打的是 `PATCH /admin/products/:id/status`，后端**无 PATCH 路由**
  //               （`rg '\.patch\(' backend/src/routes/*.routes.ts` 0 命中）⇒ 该按钮今天即 404，本行无 PUT 调用方；
  //   :disable —— 全仓无调用方（`/disable` 命中处均为 members/staff/promo-codes 等其它域）；
  //   :warning-threshold —— 全仓无调用方。
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:id/status", path: "/products/7/status", perm: "goods:edit", page: "无有效调用点（桌面打的是不存在的 PATCH，见 §十二.5 卡外观察）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:id/disable", path: "/products/7/disable", perm: "goods:edit", page: "无页面调用方" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:id/warning-threshold", path: "/products/7/warning-threshold", perm: "goods:edit", page: "无页面调用方" },

  // ---- product-bundle.routes.ts（8）：全仓无页面调用点（`api/product.ts` 只有封装；
  //      「套装与组合品」页 ProductCombo.vue 只调 GET /admin/products 与 GET /products/categories） ----
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "post", routePath: "/product-bundles", path: "/product-bundles", perm: "goods:create", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "put", routePath: "/product-bundles/:id", path: "/product-bundles/1", perm: "goods:edit", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "delete", routePath: "/product-bundles/:id", path: "/product-bundles/1", perm: "goods:delete", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "post", routePath: "/product-bundles/:id/publish", path: "/product-bundles/1/publish", perm: "goods:edit", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "post", routePath: "/product-bundles/:id/unpublish", path: "/product-bundles/1/unpublish", perm: "goods:edit", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "post", routePath: "/combo-products", path: "/combo-products", perm: "goods:create", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "put", routePath: "/combo-products/:id", path: "/combo-products/1", perm: "goods:edit", page: "无页面调用方" },
  { file: "product-bundle.routes.ts", prefix: "/api/admin", router: productBundleRouter, method: "delete", routePath: "/combo-products/:id", path: "/combo-products/1", perm: "goods:delete", page: "无页面调用方" },

  // ---- product-review.routes.ts（1）：仅「提交审核」；approve/reject/batch-* 4 行**不接**（见 UNWIRED A 类） ----
  { file: "product-review.routes.ts", prefix: "/api/admin/product-reviews", router: productReviewRouter, method: "post", routePath: "/", path: "/", perm: "goods:create", page: "无页面调用方（审核页只调 approve/reject/batch-*）" },

  // ---- unit.routes.ts（3）：全仓无写调用点（单位管理页 Units.vue 的增删改打的是 /admin/unit-groups） ----
  { file: "unit.routes.ts", prefix: "/api/admin/units", router: unitRouter, method: "post", routePath: "/", path: "/", perm: "goods:create", page: "无页面调用方" },
  { file: "unit.routes.ts", prefix: "/api/admin/units", router: unitRouter, method: "put", routePath: "/:id", path: "/1", perm: "goods:edit", page: "无页面调用方" },
  { file: "unit.routes.ts", prefix: "/api/admin/units", router: unitRouter, method: "delete", routePath: "/:id", path: "/1", perm: "goods:delete", page: "无页面调用方" },

  // ===== S3-233（B 类收编第一批 · 商品域 12 条）=================================================
  // 依据门（唯一真相源）= app-mobile/src/config/permission-gates.ts：
  //   `goods-detail-edit`（商品详情页底栏「修改/保存」，门码 = goods:create|edit|delete|price 四码全持）
  //   `goods-batch-price-submit`（批量改价页「提交」，门码 = goods:price）
  //   `goods-category-create` / `goods-category-edit` / `goods-category-delete`（分类页写按钮）
  // B 类前提（移动端商品 tab / 商品详情 / 分类页无权限门 ⇒ 使用者集合不可枚举）已由 S3-230 的入口权限门修复（D4/I1'）。
  // 逐条码选取沿用同文件先例：新增记录（建品/单位）⇒ goods:create；主数据/状态改动 ⇒ goods:edit；删除 ⇒ goods:delete；
  // 改价 ⇒ goods:price（= 本文件 :status/:disable 与本文件 unit.routes 三行的同一套口径）。
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "post", routePath: "/products/upload-image", path: "/products/upload-image", perm: "goods:create", page: "移动 `pages/products/product-detail.vue:1268`、`pages-sub/product/product/product-edit.vue:424`（门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:id", path: "/products/7", perm: "goods:edit", page: "桌面 Products.vue:1001/1134/1144 + 移动 product-detail.vue:1009（门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:skuId/price", path: "/products/7/price", perm: "goods:price", page: "桌面 Products.vue:1185/1411 + 移动 product-detail.vue:1031、batch-price.vue:834（门 goods-detail-edit / goods-batch-price-submit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId", path: "/products/skus/7", perm: "goods:edit", page: "桌面 Products.vue:1174 + 移动 `api/modules/products.ts:55`（门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "post", routePath: "/products/skus/:skuId/units", path: "/products/skus/7/units", perm: "goods:create", page: "桌面 Products.vue:1269 + 移动 product-detail.vue:1080（addSkuUnit，门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId/units/:unitId", path: "/products/skus/7/units/9", perm: "goods:edit", page: "桌面 Products.vue:1215-1253 + 移动 product-detail.vue:1049/1072（门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "delete", routePath: "/products/skus/:skuId/units/:unitId", path: "/products/skus/7/units/9", perm: "goods:delete", page: "桌面 Products.vue:1282 + 移动 product-detail.vue:1054（门 goods-detail-edit）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:spuId/marketing-tags", path: "/products/7/marketing-tags", perm: "goods:edit", page: "移动 product-detail.vue:1092（setMarketingTags，门 goods-detail-edit）" },
  { file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "post", routePath: "/", path: "/", perm: "goods:create", page: "移动 categories.vue「新增分类」（门 goods-category-create）" },
  { file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "put", routePath: "/:id", path: "/7", perm: "goods:edit", page: "移动 category-edit.vue:174（门 goods-category-edit）" },
  { file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "delete", routePath: "/:id", path: "/7", perm: "goods:delete", page: "移动 categories.vue:196（门 goods-category-delete）" },
  { file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "put", routePath: "/:id/sort", path: "/7/sort", perm: "goods:edit", page: "移动 categories.vue:179（拖拽排序，门 goods-category-edit）" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /**
   * B = 移动端写调用点落在**无权限门**的页（商品 tab / 商品详情 / 商品编辑 / 扫码），使用者集合不可枚举 ⇒ 不可判定；
   * A = 有页面调用点，且页面角色含 `STORE_MANAGER`，而生产店长**不持任何 goods 写码** ⇒ 接线即 403；
   * P = **既有已锁定/待裁定**项（本批不得自行改口径），两条价格端点均属此类。
   */
  reason: "B" | "A" | "P";
  note: string;
}

/**
 * 本域**未接**的 18 行（逐条原因见台账 §十二.3/§十二.4/§十二.6）。
 * ⚠️ S3-233（B 类收编第一批）：原 B 类 13 行中 **12 行**已随 S3-230 的入口权限门落地而收编（移入 ROWS）；
 *    剩下的 1 条 B 类 = `POST /api/admin/library/lookup`（其门前端仍为 `registered`：码未定 + 疑似查询型 POST）。
 */
const UNWIRED: UnwiredRow[] = [
  // ===== B 类（原 13 条，现仅剩 1 条）：移动端无权限门 =====
  { file: "admin-library.routes.ts", prefix: "/api/admin/library", router: adminLibraryRouter, method: "post", routePath: "/lookup", path: "/lookup", reason: "B", note: "移动扫码 `native/scan.ts:746`（商品 tab/销售开单/库存多入口，均无权限门）；桌面 Products.vue:644 亦在用" },

  // ===== A 类 15 条：页面角色含 STORE_MANAGER，生产店长不持任何 goods:* 写码 =====
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId/barcode", path: "/products/skus/7/barcode", reason: "A", note: "桌面 Products.vue:1156（商品管理页 routes:165 [SUPER_ADMIN, STORE_MANAGER]）" },
  { file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "post", routePath: "/products/import", path: "/products/import", reason: "A", note: "无调用点；归属页「商品导入」routes:169 [SUPER_ADMIN, STORE_MANAGER]，且该页真实打的 /admin/data-transfer/import/products 已接 store:transfer ⇒ 口径待裁定（§十二.7）" },
  { file: "brand.routes.ts", prefix: "/api/admin/brands", router: brandRouter, method: "post", routePath: "/", path: "/", reason: "A", note: "Brands.vue:124（品牌管理 routes:167 [SUPER_ADMIN, STORE_MANAGER]）" },
  { file: "brand.routes.ts", prefix: "/api/admin/brands", router: brandRouter, method: "put", routePath: "/:id", path: "/1", reason: "A", note: "Brands.vue:121" },
  { file: "brand.routes.ts", prefix: "/api/admin/brands", router: brandRouter, method: "delete", routePath: "/:id", path: "/1", reason: "A", note: "Brands.vue:135" },
  { file: "product-marketing-tag.routes.ts", prefix: "/api/admin/product-tags", router: productMarketingTagRouter, method: "post", routePath: "/", path: "/", reason: "A", note: "ProductTags.vue:145（商品标签 routes:170 [SUPER_ADMIN, STORE_MANAGER]）＋ MarketingTags.vue:312（营销标签 routes:221 同角色）" },
  { file: "product-marketing-tag.routes.ts", prefix: "/api/admin/product-tags", router: productMarketingTagRouter, method: "put", routePath: "/:id", path: "/1", reason: "A", note: "ProductTags.vue:142；MarketingTags.vue:307" },
  { file: "product-marketing-tag.routes.ts", prefix: "/api/admin/product-tags", router: productMarketingTagRouter, method: "delete", routePath: "/:id", path: "/1", reason: "A", note: "ProductTags.vue:156；MarketingTags.vue:328" },
  { file: "product-review.routes.ts", prefix: "/api/admin/product-reviews", router: productReviewRouter, method: "post", routePath: "/:id/approve", path: "/1/approve", reason: "A", note: "ProductReview.vue:564（商品审核 routes:173 [SUPER_ADMIN, STORE_MANAGER]）" },
  { file: "product-review.routes.ts", prefix: "/api/admin/product-reviews", router: productReviewRouter, method: "post", routePath: "/:id/reject", path: "/1/reject", reason: "A", note: "ProductReview.vue:613" },
  { file: "product-review.routes.ts", prefix: "/api/admin/product-reviews", router: productReviewRouter, method: "post", routePath: "/batch-approve", path: "/batch-approve", reason: "A", note: "ProductReview.vue:561" },
  { file: "product-review.routes.ts", prefix: "/api/admin/product-reviews", router: productReviewRouter, method: "post", routePath: "/batch-reject", path: "/batch-reject", reason: "A", note: "ProductReview.vue（批量驳回）" },
  { file: "unit-group.routes.ts", prefix: "/api/admin/unit-groups", router: unitGroupRouter, method: "post", routePath: "/", path: "/", reason: "A", note: "Units.vue:212（单位管理 routes:168 [SUPER_ADMIN, STORE_MANAGER]）" },
  { file: "unit-group.routes.ts", prefix: "/api/admin/unit-groups", router: unitGroupRouter, method: "put", routePath: "/:id", path: "/1", reason: "A", note: "Units.vue:209/235" },
  { file: "unit-group.routes.ts", prefix: "/api/admin/unit-groups", router: unitGroupRouter, method: "delete", routePath: "/:id", path: "/1", reason: "A", note: "Units.vue:223" },

  // ===== P 类 2 条：既有「查询型 POST（待裁定）」/「已知锁定」项，本批不动（见台账 §十二.6） =====
  { file: "price.routes.ts", prefix: "/api/admin/prices", router: priceRouter, method: "post", routePath: "/best-price", path: "/best-price", reason: "P", note: "`rbac-g0-wiring.test.ts:700` 列为「查询型 POST（待裁定）」并断言 READONLY 仍 200（`rbac-g1-wiring.test.ts:286` 同款锁定）；全仓无页面调用点" },
  { file: "price.routes.ts", prefix: "/api/admin/prices", router: priceRouter, method: "post", routePath: "/batch/preview", path: "/batch/preview", reason: "P", note: "已有 `requirePriceManagementAccess()` 角色白名单（非裸奔）；`rbac-g0-wiring.test.ts:725` 把「READONLY ⇒ PRICE_MANAGEMENT_DENIED」列为已知锁定 ⇒ 接 goods:price 会改第一层拦截方" },
];

/** 台账 §三.3 的本域写端点总数（10 文件） = 本批已接 15 + 未接 30 */
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

describe("S3-220 · 名单自证", () => {
  it("27 已接（15 + S3-233 收编 12）+ 18 未接 = 45（= 台账 §三.3 本域写端点总数）", () => {
    expect(ROWS).toHaveLength(27);
    expect(UNWIRED).toHaveLength(18);
    expect(ROWS.length + UNWIRED.length).toBe(DOMAIN_TOTAL);
  });

  it("已接 27 行的逐文件分布（S3-220 的 4 文件 + S3-233 新增 category.routes.ts；与台账 §十二.2/§十八 一致）", () => {
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["admin-product.routes.ts", 11],
      ["category.routes.ts", 4],
      ["product-bundle.routes.ts", 8],
      ["product-review.routes.ts", 1],
      ["unit.routes.ts", 3],
    ]);
  });

  it("已接 27 行只用 4 个**既有**权限码（两批均不新立权限点、不改角色种子、不动迁移）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual([
      "goods:create",
      "goods:delete",
      "goods:edit",
      "goods:price",
    ]);
  });

  it("未接 18 行的原因分布 = B 1 + A 15 + P 2（S3-233 收编 B 类 12 条后；与台账 §十二.3/§十二.4/§十二.6 一致）", () => {
    const byReason = new Map<string, number>();
    for (const row of UNWIRED) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    expect([...byReason.entries()].sort()).toEqual([
      ["A", 15],
      ["B", 1],
      ["P", 2],
    ]);
    // A 类（页面对 STORE_MANAGER 开放）不含任何商品域码持有关系：店长不持 goods:* 写码，逐条钉住
    expect(matchPermission(USERS[STORE_MANAGER].perms, "goods:create")).toBe(false);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "goods:edit")).toBe(false);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "goods:delete")).toBe(false);
    expect(matchPermission(USERS[STORE_MANAGER].perms, "goods:price")).toBe(true);
  });

  it("生产持有关系（`docs/evidence/S3-220/03-prod-holders.txt`）逐码钉住：goods 写码只归超管/运营，价格码另加店长", () => {
    // 持有者集合按 uid 升序（9002 超管 < 9009 店长 < 9010 运营）
    expect(holdersOf("goods:create")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
    expect(holdersOf("goods:edit")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
    expect(holdersOf("goods:delete")).toEqual([SUPER_ADMIN, OPERATION_ADMIN]);
    expect(holdersOf("goods:price")).toEqual([SUPER_ADMIN, STORE_MANAGER, OPERATION_ADMIN]);
  });
});

describe("S3-220 · 形状断言（注册行级判据，踩坑[134]）", () => {
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
});

describe("S3-220 · 两侧（未登录 401 / 无码 403 / 有码 200）", () => {
  it.each(ROWS)("$file $method $routePath：未登录 ⇒ 401", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(h.reached).toHaveLength(0);
  });

  it.each(ROWS)("$file $method $routePath：READONLY（[\"*:view\"]）⇒ 403，且未到达业务层", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(h.reached).toHaveLength(0);
  });

  it.each(ROWS)("$file $method $routePath：非持有人逐账号枚举 ⇒ 403", async (row) => {
    const holders = new Set(holdersOf(row.perm));
    const nonHolders = Object.keys(USERS)
      .map(Number)
      .filter((uid) => !holders.has(uid));
    // 防止判据退化成恒 true：非持有人必须覆盖生产里除「超管/运营（+店长，价格码）」以外的全部角色
    expect(nonHolders.length).toBeGreaterThanOrEqual(7);
    for (const uid of [STORE_OPERATOR, SALES_STAFF, WAREHOUSE_STAFF, FINANCE_STAFF, STORE_ADMIN, SALESMAN]) {
      expect(nonHolders, `${USERS[uid].name} 不该持有 ${row.perm}`).toContain(uid);
    }
    for (const uid of nonHolders) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${USERS[uid].name} 应被 403（缺 ${row.perm}）`).toBe(403);
      expect(h.reached).toHaveLength(0);
    }
  });

  it.each(ROWS)("$file $method $routePath：持有人 ⇒ 到达业务层（零回归）", async (row) => {
    const holders = holdersOf(row.perm);
    expect(holders.length).toBeGreaterThan(0);
    let saw200 = false;
    for (const uid of holders) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${label(row)}：持有人 ${USERS[uid].name} 应到达业务层`).toBe(200);
      expect(h.reached.length).toBeGreaterThan(0);
      saw200 = true;
    }
    expect(saw200, `${label(row)}：至少一个持有人应 200`).toBe(true);
  });
});

describe("S3-220 · 范围控制（本批未接的 30 行不得被顺带接上）", () => {
  it.each(UNWIRED)("$file $method $routePath：READONLY 的既有行为不变（未接线，缺口保留待后续批次）", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    if (row.reason === "P" && row.routePath === "/batch/preview") {
      // 既有 price-guard 角色白名单仍在拦（与 rbac-g0-wiring.test.ts:725 的「已知锁定」一致）⇒ 本批未改其行为
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRICE_MANAGEMENT_DENIED");
      expect(h.reached).toHaveLength(0);
      return;
    }
    expect(res.status).toBe(200);
    expect(h.reached.length).toBeGreaterThan(0);
  });
});
