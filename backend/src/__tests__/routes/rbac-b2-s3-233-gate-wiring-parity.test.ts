/**
 * S3-233 · **跨层一致性**：把 S3-230 的入口权限门（门注册表）与后端接线**绑在一起断言**
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-233.md`｜工作树 `wt-agents/S3-233`｜分支 `feat/s3-233-bclass-wiring-batch1`
 * 依据：`docs/tasks/cards/R101-S3-230-凌舟验收与裁定.md`（D4/I1'：**门补好后即可收编**）、
 *   `app-mobile/src/config/permission-gates.ts`（`ENTRY_GATES` = 门 → 码的**唯一真相源**）
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §十九｜机读台账：`backend/scripts/rbac-wiring-baseline.json`
 * 证据：`docs/evidence/S3-233/**`（含 57 条从 gaps 移除的名单生成器 `tools/s3238-wired-map.mjs`）
 *
 * 本文件要证明的五件事：
 *  a) **门 → 后端**（正向）：凡 `status === 'gated'` 的 entry，其**每一个** `endpoints` 都在后端接线，
 *     且**所用码 ∈ 该 entry 的 `codes`**（码一律取注册表，不由本批自拟）；
 *  b) **后端 → 门**（反向）：本文件列出的 62 条已接端点，每一条都至少被一道 gated 门引用
 *     （防止"表里塞进与本单无关的端点"充数）；
 *  c) **registered ⇒ 仍是无门缺口**：`status === 'registered'` 的 entry，其端点在台账里**仍登记为缺口**、
 *     注册行**不含** `requirePermission(`（防"悄悄接了但没门"）；路径与后端注册形态不一致的逐条点名登记；
 *  d) **台账一致**：a) 里的 62 条端点**不在**机读台账 `gaps` 里（= 已接线不再是缺口）；
 *  e) **运行时两侧**（逐域抽样 7 条）：非持有人 ⇒ 403 且 msg 指向该码、持有人 ⇒ 200 到达业务层、无登录态 ⇒ 401。
 *
 * ⚠️ 反测（门禁铁律）：给任一条 gated 端点**摘掉** `requirePermission(...)` ⇒ 用例 a) 必红并点名该端点
 *   （原始输出见 `docs/evidence/S3-233/raw/4x-*.txt`）；给 registered 条目偷接码 ⇒ 用例 c) 必红。
 *   注：本文件**不 exec 子进程**（本环境 vitest 起子进程会 EPERM，见 `platform-export-task.service.test.ts:22` 的记载），
 *   故后端形态由**本文件自己的行级扫描**判定（判据与 `guard-rbac-wiring.mjs` 同形：注释行不算调用）。
 *
 * QODER-9（B3-1 收口，2026-10-19，`docs/tasks/inbox/QODER-9-B31收口.md`）：门注册表 `island-aftersale` 已提为
 *   `gated`（codes = `sale:return`）且后端 aftersale approve/reject/inspect/complete 4 条已接线 ⇒ 本文件规模读数由
 *   S3-233 原态「26 门 60 行 / 11 门 43 行 / 已接 58」变为「27 门 64 行 / 9 门 38 行 / 已接 62」。
 *   ⚠️ registered 侧还吸收了 #367 链上既有的两处注册表现场变化（非本单引入，逐条见
 *   `docs/evidence/qoder-9/**`）：QODER-7 已把 16 条"跨层漂移"按注册表层修成后端真实路径/方法 ⇒ 漂移清零、
 *   16 行转普通登记；`POST /api/admin/members/:id/points/adjust` 一行已不在注册表 ⇒ 随真相源移出登记表。
 *   ⚠️ 这是**契约反转**（gated ⇒ 已接 的判据不变、由"4 条未接"变"4 条已接"），不是放宽：a) 仍用**真实注册行的
 *   `requirePermission("sale:return")`** 做形状断言（摘码即红），不是硬编码白名单。
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
        has() {
          return true;
        },
      }
    );
  };
  return { reached, perms, stub };
});

// ---- 抽样实跑所需的控制器打桩（403/401 用例不会走到控制器；200 用例需要它们返回 200）----
vi.mock("@controllers/store/order.controller", () => h.stub());
vi.mock("@controllers/store/other.controller", () => h.stub());
vi.mock("@controllers/admin/purchase.controller", () => h.stub());
vi.mock("@controllers/admin/stock-check.controller", () => h.stub());
vi.mock("@controllers/admin/category.controller", () => h.stub());
vi.mock("@controllers/admin/rbac.controller", () => h.stub());
vi.mock("@controllers/admin/marketing-new.controller", () => h.stub());
vi.mock("@controllers/admin/bank-account.controller", () => h.stub());

// ---- 权限判定：数据库读取打桩，匹配逻辑用生产同一份 matchPermission ----
vi.mock("@services/admin/rbac.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/admin/rbac.service")>();
  return {
    ...actual,
    checkUserPermission: async (userId: number, _tenantId: number, permCode: string) =>
      actual.matchPermission(h.perms.get(userId) ?? [], permCode),
  };
});

import { matchPermission } from "@services/admin/rbac.service";
import { adminOrderRouter } from "../../routes/admin-order.routes";
import { storeOrderRouter, storeHoldOrderRouter } from "../../routes/store-order.routes";
import { storeSaleBillRouter } from "../../routes/store-sale-bill.routes";
import { receiptRouter } from "../../routes/receipt.routes";
import { purchaseRouter } from "../../routes/purchase.routes";
import { purchaseInStockRouter } from "../../routes/purchase-in-stock.routes";
import { purchaseReturnRouter } from "../../routes/purchase-return.routes";
import { purchasePaymentRouter } from "../../routes/purchase-payment.routes";
import { adminStockCheckRouter, storeStockCheckRouter } from "../../routes/stock-check.routes";
import { stockWarningRouter } from "../../routes/stock-warning.routes";
import { storeInventoryRouter } from "../../routes/store-inventory.routes";
import { inventoryLossGainRouter } from "../../routes/inventory-loss-gain.routes";
import { adminTransferRouter, storeTransferRouter } from "../../routes/transfer.routes";
import { adminProductRouter } from "../../routes/admin-product.routes";
import { categoryRouter } from "../../routes/category.routes";
import { adminStaffRouter } from "../../routes/admin-staff.routes";
import { rbacRouter } from "../../routes/rbac.routes";
import { adminMarketingCouponRouter } from "../../routes/admin-marketing-coupon.routes";
import { adminMarketingFullReductionRouter } from "../../routes/admin-marketing-full-reduction.routes";
import { bankAccountRouter } from "../../routes/bank-account.routes";
import { reconciliationRouter } from "../../routes/reconciliation.routes";
import { adminAftersaleRouter } from "../../routes/aftersale.routes";

const ROUTES_DIR = fileURLToPath(new URL("../../routes", import.meta.url));
const APP_MOBILE_GATES = fileURLToPath(
  new URL("../../../../app-mobile/src/config/permission-gates.ts", import.meta.url)
);
const BASELINE_PATH = fileURLToPath(new URL("../../../scripts/rbac-wiring-baseline.json", import.meta.url));

type Method = "post" | "put" | "patch" | "delete";

/**
 * 门注册表读取（**唯一真相源**）：`permission-gates.ts` 是零依赖纯常量文件，
 * 这里按「提取 `ENTRY_GATES` 数组字面量 + 求值」读取，避免 backend 的 tsc 把 app-mobile 的 TS 拉进 rootDir。
 * ⚠️ 必须从 `= [` 起找方括号：声明里的类型标注是 `ENTRY_GATES: EntryGate[]`，直接找 `[` 会命中类型标注的空方括号。
 */
interface EntryGate {
  id: string;
  domain: string;
  entry: string;
  page: string;
  endpoints: string[];
  codes: string[];
  status: "gated" | "registered";
}
function loadEntryGates(): EntryGate[] {
  const src = readFileSync(APP_MOBILE_GATES, "utf8");
  const start = src.indexOf("export const ENTRY_GATES");
  expect(start, "permission-gates.ts 应含 ENTRY_GATES 声明").toBeGreaterThan(-1);
  const eq = src.indexOf("=", start);
  const open = src.indexOf("[", eq);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, "ENTRY_GATES 数组应配平").toBeGreaterThan(-1);
  return new Function(`return (${src.slice(open, end + 1)});`)() as EntryGate[];
}

interface WiredRow {
  /** 端点字面量（与门注册表同一写法） */
  endpoint: string;
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  /** 路由文件中注册用的路径模式 */
  routePath: string;
  /** 测试请求 URL 的路径部分 */
  path: string;
  /** 落地码（必须 ∈ 引用它的门 entry 的 codes） */
  perm: string;
}

/**
 * 本单已接端点（**62 条唯一端点**；门注册表里 gated 门共 64 端点行，其中
 * `POST /api/admin/purchase-in-stocks/`（purchase-sub-inbound + home-in-stock）与
 * `PUT /api/admin/products/:skuId/price`（goods-detail-edit + goods-batch-price-submit）各被两道门引用 ⇒ 去重后 62）。
 * 其中 57 条为 S3-233 接线（`POST /api/admin/orders/:orderNo/cancel` 早已由 S3-209 挂 `sale:void`，本单只加断言）；
 * 4 条售后（approve/reject/inspect/complete，挂 `sale:return`）由 QODER-9（B3-1 收口）补接。
 */
const WIRED_ROWS: WiredRow[] = [
  // ── 销售域 ────────────────────────────────────────────────────────────────
  { endpoint: "PUT /api/admin/orders/:orderNo/status", file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "put", routePath: "/orders/:orderNo/status", path: "/orders/O1/status", perm: "sale:create" },
  { endpoint: "POST /api/admin/orders/:orderNo/cancel", file: "admin-order.routes.ts", prefix: "/api/admin", router: adminOrderRouter, method: "post", routePath: "/orders/:orderNo/cancel", path: "/orders/O1/cancel", perm: "sale:void" },
  { endpoint: "POST /api/store/orders/:orderNo/start-delivery", file: "store-order.routes.ts", prefix: "/api/store/orders", router: storeOrderRouter, method: "post", routePath: "/:orderNo/start-delivery", path: "/O1/start-delivery", perm: "sale:create" },
  { endpoint: "POST /api/store/hold-orders/", file: "store-order.routes.ts", prefix: "/api/store/hold-orders", router: storeHoldOrderRouter, method: "post", routePath: "/", path: "/", perm: "sale:create" },
  { endpoint: "POST /api/store/sale-bills/:billNo/offline-payment", file: "store-sale-bill.routes.ts", prefix: "/api/store/sale-bills", router: storeSaleBillRouter, method: "post", routePath: "/:billNo/offline-payment", path: "/B1/offline-payment", perm: "sale:create" },
  { endpoint: "POST /api/admin/receipts/", file: "receipt.routes.ts", prefix: "/api/admin/receipts", router: receiptRouter, method: "post", routePath: "/", path: "/", perm: "sale:create" },
  // QODER-9（B3-1 收口）：`island-aftersale`（gated，codes=[`sale:return`]）4 条 ⇒ 与同文件 confirm-receipt（S3-224）同码接线
  { endpoint: "POST /api/admin/aftersales/:id/approve", file: "aftersale.routes.ts", prefix: "/api/admin", router: adminAftersaleRouter, method: "post", routePath: "/aftersales/:id/approve", path: "/aftersales/1/approve", perm: "sale:return" },
  { endpoint: "POST /api/admin/aftersales/:id/reject", file: "aftersale.routes.ts", prefix: "/api/admin", router: adminAftersaleRouter, method: "post", routePath: "/aftersales/:id/reject", path: "/aftersales/1/reject", perm: "sale:return" },
  { endpoint: "POST /api/admin/aftersales/:id/inspect", file: "aftersale.routes.ts", prefix: "/api/admin", router: adminAftersaleRouter, method: "post", routePath: "/aftersales/:id/inspect", path: "/aftersales/1/inspect", perm: "sale:return" },
  { endpoint: "POST /api/admin/aftersales/:id/complete", file: "aftersale.routes.ts", prefix: "/api/admin", router: adminAftersaleRouter, method: "post", routePath: "/aftersales/:id/complete", path: "/aftersales/1/complete", perm: "sale:return" },

  // ── 采购域 ────────────────────────────────────────────────────────────────
  { endpoint: "POST /api/admin/purchase-orders/", file: "purchase.routes.ts", prefix: "/api/admin/purchase-orders", router: purchaseRouter, method: "post", routePath: "/", path: "/", perm: "purchase:create" },
  { endpoint: "POST /api/admin/purchase-in-stocks/", file: "purchase-in-stock.routes.ts", prefix: "/api/admin/purchase-in-stocks", router: purchaseInStockRouter, method: "post", routePath: "/", path: "/", perm: "inventory:inbound" },
  { endpoint: "POST /api/admin/purchase-returns/", file: "purchase-return.routes.ts", prefix: "/api/admin/purchase-returns", router: purchaseReturnRouter, method: "post", routePath: "/", path: "/", perm: "sale:return" },
  { endpoint: "POST /api/admin/purchase-payments/", file: "purchase-payment.routes.ts", prefix: "/api/admin/purchase-payments", router: purchasePaymentRouter, method: "post", routePath: "/", path: "/", perm: "finance:payment" },

  // ── 库存 / 追溯域 ─────────────────────────────────────────────────────────
  { endpoint: "POST /api/admin/stock-checks/", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/", path: "/", perm: "inventory:create" },
  { endpoint: "PUT /api/admin/stock-checks/:id", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "put", routePath: "/:id", path: "/1", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/stock-checks/:id/start", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/start", path: "/1/start", perm: "inventory:create" },
  { endpoint: "POST /api/admin/stock-checks/:id/complete", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/complete", path: "/1/complete", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/stock-checks/:id/cancel", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/cancel", path: "/1/cancel", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/stock-checks/:id/handle-diff", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/handle-diff", path: "/1/handle-diff", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/stock-checks/:id/items", file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/items", path: "/1/items", perm: "inventory:create" },
  { endpoint: "PUT /api/store/stock-checks/:id/items/:itemId", file: "stock-check.routes.ts", prefix: "/api/store/stock-checks", router: storeStockCheckRouter, method: "put", routePath: "/:id/items/:itemId", path: "/1/items/9", perm: "inventory:adjust" },
  { endpoint: "POST /api/store/stock-checks/:id/submit", file: "stock-check.routes.ts", prefix: "/api/store/stock-checks", router: storeStockCheckRouter, method: "post", routePath: "/:id/submit", path: "/1/submit", perm: "inventory:create" },
  { endpoint: "POST /api/admin/stock-warnings/config", file: "stock-warning.routes.ts", prefix: "/api/admin/stock-warnings", router: stockWarningRouter, method: "post", routePath: "/config", path: "/config", perm: "inventory:adjust" },
  { endpoint: "PUT /api/store/inventory/alerts/:skuId/threshold", file: "store-inventory.routes.ts", prefix: "/api/store/inventory", router: storeInventoryRouter, method: "put", routePath: "/alerts/:skuId/threshold", path: "/alerts/S1/threshold", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/inventory/report-loss-gain", file: "inventory-loss-gain.routes.ts", prefix: "/api/admin/inventory", router: inventoryLossGainRouter, method: "post", routePath: "/report-loss-gain", path: "/report-loss-gain", perm: "inventory:adjust" },
  { endpoint: "POST /api/admin/transfers/", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/", path: "/", perm: "store:transfer" },
  { endpoint: "PUT /api/admin/transfers/:id", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "put", routePath: "/:id", path: "/1", perm: "store:transfer" },
  { endpoint: "POST /api/admin/transfers/:id/submit", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/submit", path: "/1/submit", perm: "store:transfer" },
  { endpoint: "POST /api/admin/transfers/:id/approve", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/approve", path: "/1/approve", perm: "store:transfer" },
  { endpoint: "POST /api/admin/transfers/:id/reject", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/reject", path: "/1/reject", perm: "store:transfer" },
  { endpoint: "POST /api/admin/transfers/:id/cancel", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/cancel", path: "/1/cancel", perm: "store:transfer" },
  { endpoint: "POST /api/admin/transfers/:id/ship", file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/ship", path: "/1/ship", perm: "store:transfer" },
  { endpoint: "POST /api/store/transfers/:id/receive", file: "transfer.routes.ts", prefix: "/api/store/transfers", router: storeTransferRouter, method: "post", routePath: "/:id/receive", path: "/1/receive", perm: "store:transfer" },

  // ── 商品域 ────────────────────────────────────────────────────────────────
  { endpoint: "PUT /api/admin/products/:id", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:id", path: "/products/7", perm: "goods:edit" },
  { endpoint: "PUT /api/admin/products/:skuId/price", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:skuId/price", path: "/products/7/price", perm: "goods:price" },
  { endpoint: "PUT /api/admin/products/skus/:skuId", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId", path: "/products/skus/7", perm: "goods:edit" },
  { endpoint: "POST /api/admin/products/skus/:skuId/units", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "post", routePath: "/products/skus/:skuId/units", path: "/products/skus/7/units", perm: "goods:create" },
  { endpoint: "PUT /api/admin/products/skus/:skuId/units/:unitId", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/skus/:skuId/units/:unitId", path: "/products/skus/7/units/9", perm: "goods:edit" },
  { endpoint: "DELETE /api/admin/products/skus/:skuId/units/:unitId", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "delete", routePath: "/products/skus/:skuId/units/:unitId", path: "/products/skus/7/units/9", perm: "goods:delete" },
  { endpoint: "PUT /api/admin/products/:spuId/marketing-tags", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "put", routePath: "/products/:spuId/marketing-tags", path: "/products/7/marketing-tags", perm: "goods:edit" },
  { endpoint: "POST /api/admin/products/upload-image", file: "admin-product.routes.ts", prefix: "/api/admin", router: adminProductRouter, method: "post", routePath: "/products/upload-image", path: "/products/upload-image", perm: "goods:create" },
  { endpoint: "POST /api/admin/products/categories/", file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "post", routePath: "/", path: "/", perm: "goods:create" },
  { endpoint: "PUT /api/admin/products/categories/:id", file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "put", routePath: "/:id", path: "/7", perm: "goods:edit" },
  { endpoint: "PUT /api/admin/products/categories/:id/sort", file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "put", routePath: "/:id/sort", path: "/7/sort", perm: "goods:edit" },
  { endpoint: "DELETE /api/admin/products/categories/:id", file: "category.routes.ts", prefix: "/api/admin/products/categories", router: categoryRouter, method: "delete", routePath: "/:id", path: "/7", perm: "goods:delete" },

  // ── 员工 / 账号域 ─────────────────────────────────────────────────────────
  { endpoint: "POST /api/admin/staff", file: "admin-staff.routes.ts", prefix: "/api/admin", router: adminStaffRouter, method: "post", routePath: "/staff", path: "/staff", perm: "system:user:create" },
  { endpoint: "PUT /api/admin/staff/:id", file: "admin-staff.routes.ts", prefix: "/api/admin", router: adminStaffRouter, method: "put", routePath: "/staff/:id", path: "/staff/1", perm: "system:user:edit" },
  { endpoint: "PUT /api/admin/staff/:id/disable", file: "admin-staff.routes.ts", prefix: "/api/admin", router: adminStaffRouter, method: "put", routePath: "/staff/:id/disable", path: "/staff/1/disable", perm: "system:user:edit" },
  { endpoint: "POST /api/admin/staff/:id/restore", file: "admin-staff.routes.ts", prefix: "/api/admin", router: adminStaffRouter, method: "post", routePath: "/staff/:id/restore", path: "/staff/1/restore", perm: "system:user:edit" },
  { endpoint: "POST /api/admin/system/roles/", file: "rbac.routes.ts", prefix: "/api/admin/system/roles", router: rbacRouter, method: "post", routePath: "/", path: "/", perm: "system:role:create" },
  { endpoint: "PUT /api/admin/system/roles/:id", file: "rbac.routes.ts", prefix: "/api/admin/system/roles", router: rbacRouter, method: "put", routePath: "/:id", path: "/1", perm: "system:role:edit" },
  { endpoint: "DELETE /api/admin/system/roles/:id", file: "rbac.routes.ts", prefix: "/api/admin/system/roles", router: rbacRouter, method: "delete", routePath: "/:id", path: "/1", perm: "system:role:edit" },

  // ── 营销域 ────────────────────────────────────────────────────────────────
  { endpoint: "POST /api/admin/marketing/coupons/templates", file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "post", routePath: "/coupons/templates", path: "/coupons/templates", perm: "marketing:create" },
  { endpoint: "POST /api/admin/marketing/coupons/templates/:id/pause", file: "admin-marketing-coupon.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingCouponRouter, method: "post", routePath: "/coupons/templates/:id/pause", path: "/coupons/templates/1/pause", perm: "marketing:create" },
  { endpoint: "POST /api/admin/marketing/full-reductions/:id/activate", file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "post", routePath: "/full-reductions/:id/activate", path: "/full-reductions/1/activate", perm: "marketing:create" },
  { endpoint: "POST /api/admin/marketing/full-reductions/:id/pause", file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "post", routePath: "/full-reductions/:id/pause", path: "/full-reductions/1/pause", perm: "marketing:create" },
  { endpoint: "DELETE /api/admin/marketing/full-reductions/:id", file: "admin-marketing-full-reduction.routes.ts", prefix: "/api/admin/marketing", router: adminMarketingFullReductionRouter, method: "delete", routePath: "/full-reductions/:id", path: "/full-reductions/1", perm: "marketing:create" },

  // ── 财务域 ────────────────────────────────────────────────────────────────
  { endpoint: "POST /api/admin/bank-accounts/", file: "bank-account.routes.ts", prefix: "/api/admin/bank-accounts", router: bankAccountRouter, method: "post", routePath: "/", path: "/", perm: "finance:create" },
  { endpoint: "POST /api/admin/bank-accounts/:id/close", file: "bank-account.routes.ts", prefix: "/api/admin/bank-accounts", router: bankAccountRouter, method: "post", routePath: "/:id/close", path: "/1/close", perm: "finance:create" },
  { endpoint: "POST /api/admin/reconciliation/customer/:customerId/confirm", file: "reconciliation.routes.ts", prefix: "/api/admin/reconciliation", router: reconciliationRouter, method: "post", routePath: "/customer/:customerId/confirm", path: "/customer/1/confirm", perm: "report:finance" },
  { endpoint: "POST /api/admin/reconciliation/supplier/:supplierId/confirm", file: "reconciliation.routes.ts", prefix: "/api/admin/reconciliation", router: reconciliationRouter, method: "post", routePath: "/supplier/:supplierId/confirm", path: "/supplier/1/confirm", perm: "report:finance" },
];

interface RegisteredRow {
  endpoint: string;
  file: string;
  method: Method;
  /** 后端**实际注册**的路径模式（与注册表写法不一致时按实际填，用于行级扫描） */
  routePath: string;
  /** 机读台账 `gaps` 里该端点的写法（缺省同 `endpoint`；路径参数带正则约束时两者不同） */
  gapEndpoint?: string;
  /** 注册表路径 → 后端注册形态是否一致；false = 跨层漂移（逐条登记，不接） */
  sameAsRegistry: boolean;
  /** 漂移说明（`sameAsRegistry: false` 时必填） */
  drift?: string;
}

/**
 * `status === 'registered'` 的门共 **38 端点行**（门注册表 §八 孤岛页 + 码未定项；
 * S3-233 原态 43 行：QODER-9 移入已接表 4 行〔island-aftersale〕、随现场注册表移除 1 行
 * 〔`POST /api/admin/members/:id/points/adjust` 已不在注册表〕）。
 * 这些**一律不接**；本文件只做两件事：① 断言其注册行**不含** `requirePermission(`；
 * ② 断言其仍在机读台账 `gaps` 里（防"悄悄接了但没门"）。跨层漂移的逐条点名（QODER-7 修复后为 0 行，用例保留防回归）。
 */
const REGISTERED_ROWS: RegisteredRow[] = [
  { endpoint: "POST /api/admin/trace/verify", file: "trace.routes.ts", method: "post", routePath: "/verify", sameAsRegistry: true },
  { endpoint: "POST /api/admin/library/lookup", file: "admin-library.routes.ts", method: "post", routePath: "/lookup", sameAsRegistry: true },
  { endpoint: "POST /api/store/coupons/verify", file: "store-coupon.routes.ts", method: "post", routePath: "/verify", sameAsRegistry: true },
  { endpoint: "POST /api/store/coupons/manual-verify", file: "store-coupon.routes.ts", method: "post", routePath: "/manual-verify", sameAsRegistry: true },
  // QODER-9 同步现场注册表：`POST /api/admin/members/:id/points/adjust` 一行**已不在门注册表**（#367 尖端 registered 门实测 9 道 38 行）
  //   ⇒ 本表随真相源移除；该端点仍在台账 gaps（`points.routes.ts`）由各接线批用例与守卫看管，不属 parity 范围。
  { endpoint: "POST /api/admin/marketing/points/redeem", file: "admin-marketing-points.routes.ts", method: "post", routePath: "/points/redeem", sameAsRegistry: true },
  { endpoint: "POST /api/store/customer-statements/:statementNo/confirm", file: "customer-statement.routes.ts", method: "post", routePath: "/:statementNo/confirm", sameAsRegistry: true },
  { endpoint: "POST /api/admin/quote-push/", file: "admin-quote-push.routes.ts", method: "post", routePath: "/", sameAsRegistry: true },
  // QODER-9（B3-1 收口）：原这 4 行 `POST /api/admin/aftersales/:id/{approve,reject,inspect,complete}` 属 registered；
  // 门注册表 `island-aftersale` 已提 gated 且后端已挂 `requirePermission("sale:return")` ⇒ 4 行移入 `WIRED_ROWS`（已接表）。
  { endpoint: "POST /api/admin/order-exceptions", file: "order-exception.routes.ts", method: "post", routePath: "/order-exceptions", sameAsRegistry: true },
  // 后端注册为 `PUT /order-exceptions/:id(\d+)`（带数字约束）⇒ 与注册表写法 `/:id` 形态不同，但是**同一行**（路径参数约束差异，非漂移）
  // ⚠️ file 里的字面量是**双反斜杠**（`:id(\\\\d+)` ⇒ 运行期 `:id(\\d+)`），故 routePath 必须写四反斜杠才能逐字匹配；
  //    台账 `gaps` 也按该形态登记 ⇒ `gapEndpoint` 用同一写法（踩坑[134]：判据落到注册行本身）。
  { endpoint: "PUT /api/admin/order-exceptions/:id", file: "order-exception.routes.ts", method: "put", routePath: "/order-exceptions/:id(\\\\d+)", gapEndpoint: "PUT /api/admin/order-exceptions/:id(\\d+)", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/order-exceptions/:id/status", file: "order-exception.routes.ts", method: "put", routePath: "/order-exceptions/:id(\\\\d+)/status", gapEndpoint: "PUT /api/admin/order-exceptions/:id(\\d+)/status", sameAsRegistry: true },
  { endpoint: "POST /api/store/sale-bills/:billNo/collection-link", file: "store-sale-bill.routes.ts", method: "post", routePath: "/:billNo/collection-link", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/orders/:orderNo/status", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/orders/:orderNo/status", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/routing-rules", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/routing-rules", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/instant-retail/routing-rules/:id", file: "instant-retail-admin-ops.routes.ts", method: "put", routePath: "/routing-rules/:id", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/routing-rules/:id", file: "instant-retail-admin-ops.routes.ts", method: "delete", routePath: "/routing-rules/:id", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/exceptions/:id/handle", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/exceptions/:id/handle", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/shelf", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/shelf", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/instant-retail/shelf/:id", file: "instant-retail-admin-ops.routes.ts", method: "put", routePath: "/shelf/:id", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/shelf/:id", file: "instant-retail-admin-ops.routes.ts", method: "delete", routePath: "/shelf/:id", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/deliveries/:deliveryId/assign", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/deliveries/:deliveryId/assign", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/reviews/:id/reply", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/reviews/:id/reply", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/reviews/sync", file: "instant-retail-admin-ops.routes.ts", method: "post", routePath: "/reviews/sync", sameAsRegistry: true },
  // ---- 以下 16 条：原 S3-233 记为**跨层漂移**（注册表写 `/platform` 段 + deliveries status 写 POST）；
  //      QODER-7 已按注册表层修复（注册表改成后端真实路径/方法，contractDrift debt=0）⇒ 自 QODER-9 起
  //      这 16 行与后端注册行**逐字一致**（`instant-retail-admin-platform.routes.ts:16-49`、
  //      `instant-retail-admin-ops.routes.ts:61`），转普通 sameAsRegistry 登记；漂移用例保留作防回归（现覆盖 0 行）。 ----
  { endpoint: "PUT /api/admin/instant-retail/deliveries/:deliveryId/status", file: "instant-retail-admin-ops.routes.ts", method: "put", routePath: "/deliveries/:deliveryId/status", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/configs", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/configs", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/configs/:platform/test", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/configs/:platform/test", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/configs/:platform/sync-orders", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/configs/:platform/sync-orders", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/configs/:platform/sync-products", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/configs/:platform/sync-products", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/configs/:platform", file: "instant-retail-admin-platform.routes.ts", method: "delete", routePath: "/configs/:platform", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/shop-config", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/shop-config", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/categories", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/categories", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/instant-retail/categories/:id", file: "instant-retail-admin-platform.routes.ts", method: "put", routePath: "/categories/:id", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/categories/:id", file: "instant-retail-admin-platform.routes.ts", method: "delete", routePath: "/categories/:id", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/products", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/products", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/instant-retail/products/:id", file: "instant-retail-admin-platform.routes.ts", method: "put", routePath: "/products/:id", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/products/:id", file: "instant-retail-admin-platform.routes.ts", method: "delete", routePath: "/products/:id", sameAsRegistry: true },
  { endpoint: "POST /api/admin/instant-retail/banners", file: "instant-retail-admin-platform.routes.ts", method: "post", routePath: "/banners", sameAsRegistry: true },
  { endpoint: "PUT /api/admin/instant-retail/banners/:id", file: "instant-retail-admin-platform.routes.ts", method: "put", routePath: "/banners/:id", sameAsRegistry: true },
  { endpoint: "DELETE /api/admin/instant-retail/banners/:id", file: "instant-retail-admin-platform.routes.ts", method: "delete", routePath: "/banners/:id", sameAsRegistry: true },
];

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

const gates = loadEntryGates();
const gatedGates = gates.filter((g) => g.status === "gated");
const registeredGates = gates.filter((g) => g.status === "registered");

/** 端点字面量 → 本文件已接行 */
const wiredByEndpoint = new Map(WIRED_ROWS.map((r) => [r.endpoint, r]));

/** 复算「该权限码在本测试账号集里有谁持有」（生产同一份 matchPermission） */
function holdersOf(perm: string): number[] {
  return Object.keys(USERS)
    .map(Number)
    .filter((uid) => matchPermission(USERS[uid].perms, perm))
    .sort((a, b) => a - b);
}

/**
 * 测试账号：权限串 = **生产只读实值**（`docs/evidence/_shared/prod-roles-20261016.txt`，租户 `default`）。
 * 与各域批次用例同一份口径；`storeId` 必带（门店端中间件会先判门店归属）。
 */
const USERS: Record<number, { name: string; roles: string[]; perms: string[]; storeId?: number }> = {
  9001: { name: "readonly", roles: ["READONLY"], perms: ["*:view"], storeId: 1 },
  9002: { name: "super_admin", roles: ["SUPER_ADMIN"], perms: ["*"], storeId: 1 },
  9003: { name: "store_manager", roles: ["STORE_MANAGER"], perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*", "finance:payment", "goods:price", "finance:daily-settle"], storeId: 1 },
  9004: { name: "store_operator", roles: ["STORE_OPERATOR"], perms: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"], storeId: 1 },
  9005: { name: "sales_staff", roles: ["SALES_STAFF"], perms: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"], storeId: 1 },
  9006: { name: "finance_staff", roles: ["FINANCE_STAFF"], perms: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"], storeId: 1 },
  9007: { name: "warehouse_staff", roles: ["WAREHOUSE_STAFF"], perms: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"], storeId: 1 },
  9008: { name: "purchase_staff", roles: ["PURCHASE_STAFF"], perms: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"], storeId: 1 },
  9009: { name: "operation_admin", roles: ["OPERATION_ADMIN"], perms: ["*"], storeId: 1 },
  9010: { name: "store_admin", roles: ["STORE_ADMIN"], perms: ["product:read", "order:read", "order:write", "inventory:read", "inventory:write"], storeId: 1 },
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;

beforeEach(() => {
  h.reached.length = 0;
  h.perms.clear();
  for (const [id, u] of Object.entries(USERS)) h.perms.set(Number(id), u.perms);
});

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

describe("S3-233 · 门注册表读取（唯一真相源自证）", () => {
  it("门注册表规模：27 道 gated（64 端点行）+ 9 道 registered（38 端点行）", () => {
    expect(gatedGates).toHaveLength(27);
    expect(gatedGates.reduce((n, g) => n + g.endpoints.length, 0)).toBe(64);
    expect(registeredGates).toHaveLength(9);
    expect(registeredGates.reduce((n, g) => n + g.endpoints.length, 0)).toBe(38);
  });

  it("gated 门的 codes 非空；registered 门的 codes 恒为空（注册表自身的契约）", () => {
    for (const g of gatedGates) expect(g.codes.length, `${g.id} 的 codes 不得为空`).toBeGreaterThan(0);
    for (const g of registeredGates) expect(g.codes, `${g.id}（只登记不门）的 codes 必须为空`).toEqual([]);
  });
});

describe("S3-233 · a) 门 → 后端：gated 门的每条端点都已接线，且码 ∈ 该门 codes", () => {
  const cases = gatedGates.flatMap((g) => g.endpoints.map((ep) => ({ gate: g, ep })));

  it("64 条门端点行逐条可对到本文件的已接表（无遗漏）", () => {
    const missing = cases.filter(({ ep }) => !wiredByEndpoint.has(ep));
    expect(missing.map(({ gate, ep }) => `${gate.id} | ${ep}`)).toEqual([]);
  });

  it.each(cases)("$ep（门 $gate.id）：所用码 ∈ 门 codes，且注册行自带该码", ({ gate, ep }) => {
    const row = wiredByEndpoint.get(ep);
    expect(row, `${ep} 应有已接行`).toBeTruthy();
    // ① 码一律取注册表：落地码必须落在该门声明的 codes 集合内
    expect(gate.codes, `${ep} 的落地码 ${row!.perm} 必须 ∈ 门 ${gate.id} 的 codes`).toContain(row!.perm);
    // ② 注册行级自证（摘掉中间件即红）
    const lines = registrationLines(row!.file, row!.method, row!.routePath);
    expect(lines.map((l) => l.no), `${row!.file} ${row!.method} ${row!.routePath} 应恰好 1 行`).toHaveLength(1);
    expect(lines[0].line, `${ep} 的注册行必须自带 requirePermission("${row!.perm}")`).toContain(
      `requirePermission("${row!.perm}")`
    );
  });
});

describe("S3-233 · b) 后端 → 门：已接表的每条端点都至少被一道 gated 门引用", () => {
  const gatedEndpointSet = new Set(gatedGates.flatMap((g) => g.endpoints));

  it("62 条唯一端点全部有门（无‘与本单无关的端点’混进表里）", () => {
    const extra = WIRED_ROWS.filter((r) => !gatedEndpointSet.has(r.endpoint)).map((r) => r.endpoint);
    expect(extra).toEqual([]);
  });

  it("去重后 62 条；其中 1 条（订单取消）为 S3-209 既有接线，本单只加断言", () => {
    expect(new Set(WIRED_ROWS.map((r) => r.endpoint)).size).toBe(62);
    expect(WIRED_ROWS.filter((r) => r.endpoint === "POST /api/admin/orders/:orderNo/cancel")).toHaveLength(1);
  });
});

describe("S3-233 · c) registered ⇒ 仍是无门缺口（防‘悄悄接了但没门’）", () => {
  it("门注册表 38 行与本文件登记表逐条对齐（跨层漂移已由 QODER-7 按注册表层修掉 ⇒ 漂移 0 行）", () => {
    const registry = registeredGates.flatMap((g) => g.endpoints).sort();
    const table = REGISTERED_ROWS.map((r) => r.endpoint).sort();
    expect(table).toEqual(registry);
    expect(REGISTERED_ROWS.filter((r) => !r.sameAsRegistry)).toHaveLength(0);
  });

  it.each(REGISTERED_ROWS.filter((r) => r.sameAsRegistry))(
    "$endpoint：注册行**不含** requirePermission（只登记不门）",
    (row) => {
      const lines = registrationLines(row.file, row.method, row.routePath);
      expect(lines.map((l) => l.no), `${row.file} ${row.method} ${row.routePath} 应恰好 1 行`).toHaveLength(1);
      expect(lines[0].line, `${row.endpoint} 不得接线（门注册表 status=registered）`).not.toContain("requirePermission(");
    }
  );

  // S3-233 收尾（2026-10-16）：条数**由数据推导**（= REGISTERED_ROWS 里 sameAsRegistry 的条数），
  //   原先写死的 "25 条" 与本用例自身的筛选口径（QODER-9 现场：38 − 0 漂移 = 38）不一致 ⇒ 标题与断言必须同源。
  it(`registered 的 ${REGISTERED_ROWS.filter((r) => r.sameAsRegistry).length} 条（后端已注册的）**仍在机读台账 gaps 里**（第二真值源）`, () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { gaps: Record<string, string[]> };
    const gapSet = new Set(Object.entries(baseline.gaps).flatMap(([f, list]) => list.map((p) => `${f}|${p}`)));
    const missing = REGISTERED_ROWS.filter((r) => r.sameAsRegistry)
      .map((r) => `${r.file}|${r.gapEndpoint ?? r.endpoint}`)
      .filter((k) => !gapSet.has(k));
    expect(missing).toEqual([]);
  });

  it("跨层漂移逐条点名（漂移行必须由本单**只登记、不接**；QODER-7 修复注册表后当前 0 行，用例保留防漂移复发）", () => {
    const drift = REGISTERED_ROWS.filter((r) => !r.sameAsRegistry);
    for (const r of drift) {
      expect(r.drift, `${r.endpoint} 的漂移说明不得为空`).toBeTruthy();
      // 后端确实没有与注册表**同方法同路径**的注册行（否则就是漏接，而不是漂移）
      const sameMethodAndPath = registrationLines(r.file, r.method, r.endpoint.split(" ")[1]);
      expect(sameMethodAndPath, `${r.endpoint} 不应存在同方法同路径的注册行`).toHaveLength(0);
    }
  });
});

describe("S3-233 · d) 台账一致：已接端点不再登记为缺口", () => {
  it("62 条已接端点全部**不在**机读台账 gaps 里", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { gaps: Record<string, string[]> };
    const gapSet = new Set(Object.entries(baseline.gaps).flatMap(([f, list]) => list.map((p) => `${f}|${p}`)));
    const stillGap = WIRED_ROWS.map((r) => `${r.file}|${r.endpoint}`).filter((k) => gapSet.has(k));
    expect(stillGap).toEqual([]);
  });

  it("台账读数自洽（只写和式 + 台账一致性；跨批裸数字按派单规范 §9.2 不写）", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
      gaps: Record<string, string[]>;
      _counts: {
        files: number;
        endpoints: number;
        consumerEndEndpoints: number;
        readOnlyPostEndpoints: number;
        wiredEndpoints: number;
        scannedEndpoints: number;
      };
    };
    const endpoints = Object.values(baseline.gaps).reduce((n, list) => n + list.length, 0);
    const c = baseline._counts;
    // ① 台账自身自洽：数组与 `_counts` 一致
    expect(Object.keys(baseline.gaps).length).toBe(c.files);
    expect(endpoints).toBe(c.endpoints);
    // ② 第二真值源（派单规范 §9.2）：已接线 + 缺口 + 消费者端形态 + 查询型 POST == 扫描总数
    expect(c.wiredEndpoints + c.endpoints + c.consumerEndEndpoints + c.readOnlyPostEndpoints).toBe(c.scannedEndpoints);
    // ⚠️ S3-233 收尾（2026-10-16）**删掉的两个裸数字断言**：原为 `expect(endpoints).toBe(321)` / `expect(c.files).toBe(94)`。
    //    为什么删：那是**跨批共享**的单点数字（本批 378/113 → 321/94；rebase 到含 #358 的 `origin/main`（371/113）后应为
    //    **314/91**），每批都要改同一行——派单规范 §9.2 明令禁止（既有实测：同一行被三批各改一次）。
    //    本单读数改由**原始输出**固定（`docs/evidence/S3-233/raw/33-strict-after.txt` 与 `raw/64-s3240-final-check.txt`
    //    的 `--strict` 读数 321 条 / 94 文件；rebase 投影见 `raw/63-s3240-main-vs-branch-baseline.txt`）。
    //    ⇒ 这是**断言口径的规范化**（改为和式 + 自洽），不是放宽：① ② 两条比裸数字更严（裸数字只查两个数，自洽式查整份台账的收支平衡）。
  });
});

describe("S3-233 · e) 运行时两侧（逐域抽样 7 条：非持有人 403 / 持有人 200 / 无登录 401）", () => {
  /** 抽样：7 个域各 1 条（覆盖 7 个不同权限码） */
  const SAMPLE_ENDPOINTS = [
    "POST /api/store/orders/:orderNo/start-delivery",
    "POST /api/admin/purchase-orders/",
    "POST /api/admin/stock-checks/:id/handle-diff",
    "POST /api/admin/products/categories/",
    "POST /api/admin/system/roles/",
    "POST /api/admin/marketing/coupons/templates",
    "POST /api/admin/bank-accounts/:id/close",
  ];
  const SAMPLE = SAMPLE_ENDPOINTS.map((ep) => {
    const row = wiredByEndpoint.get(ep);
    expect(row, `${ep} 应在已接表里`).toBeTruthy();
    return row!;
  });
  const APPS = new Map<string, express.Express>();
  function appFor(row: WiredRow) {
    const key = `${row.file}|${row.prefix}`;
    if (!APPS.has(key)) APPS.set(key, buildApp(row.prefix, row.router));
    return APPS.get(key)!;
  }

  it("抽样覆盖 7 个不同域 / 7 个不同权限码", () => {
    expect(SAMPLE).toHaveLength(7);
    expect(new Set(SAMPLE.map((r) => r.perm)).size).toBe(7);
  });

  it.each(SAMPLE)("$endpoint：READONLY（*:view）⇒ 403 且 msg 指向该码、未到达业务层", async (row) => {
    h.reached.length = 0;
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(h.reached, "未到达业务层").toEqual([]);
  });

  it.each(SAMPLE)("$endpoint：全部持有人（逐账号枚举）⇒ 200 且到达业务层", async (row) => {
    const holders = holdersOf(row.perm);
    expect(holders.length, `${row.perm} 应至少 1 个持有人`).toBeGreaterThan(0);
    for (const uid of holders) {
      h.reached.length = 0;
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${row.endpoint}／uid=${uid}（${USERS[uid].name}）`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(h.reached.length, `${row.endpoint}／uid=${uid} 应到达业务层`).toBeGreaterThan(0);
    }
  });

  it.each(SAMPLE)("$endpoint：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
  });

  it("反证（判据不是恒 true）：超管（`*`）与 READONLY 的结论不同 ⇒ 拦的是权限码本身", async () => {
    const row = SAMPLE[0];
    const denied = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    const allowed = await call(appFor(row), row.method, `${row.prefix}${row.path}`, SUPER_ADMIN);
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });
});
