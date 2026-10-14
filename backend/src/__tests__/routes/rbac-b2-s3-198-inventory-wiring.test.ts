/**
 * S3-198 批B2-2 · **库存 / 追溯域**权限接线验收测试
 *
 * 派单卡：`docs/tasks/inbox/ACTIVE-S3-198.md`
 * 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.12（域明细）＋ §九（本批接线明细与守恒）
 * 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 671 条）
 *
 * 本文件要证明的五件事（对应派单卡 §二.4 / §三.2 / §四；数字为**返工后**口径）：
 *  a) 本批已接 **25 行**的**注册行级**形状断言（踩坑[134]：注释里的 `requirePermission(` 不算调用）；
 *  b) 只读账号（READONLY = `["*:view"]`）调 25 行 ⇒ **403** 且**未到达业务层**；
 *  c) 持有该权限点的角色 ⇒ **200**（到达控制器，不锁死既有页面角色）；
 *  d) 反证：不持有该码的角色 ⇒ **403**（证明判据不是恒 true 的假门禁）；
 *  e) **范围控制**：本域**未接**的 32 行 ⇒ READONLY 仍 200，且注册行级不含 `requirePermission(`
 *     （证明本批「没多接」，同时把 B 类、A 类、N 类与「待补授权」的端点显式钉住）。
 *
 * 返工记录（凌舟裁定 R101-S3-198，2026-10-14）：`trace.routes.ts` 的 9 条 `trace:code` 接线**全部退回** ——
 *   生产 `t_sys_role.permissions` 实测门店角色**不含 `trace:*`**（`t_sys_role_permission` 0 命中），
 *   「追溯是否授权门店端」属产品授权口径 ⇒ 留台账、待另立补授权单。故 34 → 25，未接 23 → 32（新增 P 类 9 条）。
 *
 * 保真度说明：
 *  · 真：路由文件与其注册顺序、`requirePermission` 中间件本体、`matchPermission` 权限匹配器
 *        （`services/admin/rbac.service.ts`）、CSRF 在挂载层先于路由匹配的顺序（踩坑[34]）。
 *  · 桩：`checkUserPermission` 的**数据库读取**（用角色权限串喂真实匹配器）、控制器
 *        （只记录「请求是否到达业务层」）、登录态（生产由 requireAuth 从 JWT 取，本测试用请求头注入）。
 *
 * 反测（门禁铁律）：摘掉任一条本批 `requirePermission(...)` ⇒ 对应「READONLY ⇒ 403」用例必红；
 * 复原 ⇒ 绿（原始输出见 `docs/tasks/inbox/ACTIVE-回执-S3-198.md` §反测）。
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
vi.mock("@controllers/admin/data-transfer.controller", () => h.stub());
vi.mock("@controllers/admin/inventory-batch.controller", () => h.stub());
vi.mock("@controllers/admin/inventory-share.controller", () => h.stub());
vi.mock("@controllers/admin/trace-config.controller", () => h.stub());
vi.mock("@controllers/admin/trace-records.controller", () => h.stub());
vi.mock("@controllers/admin/transfer-order-v2.controller", () => h.stub());
vi.mock("@controllers/admin/warehouse.controller", () => h.stub());
vi.mock("@controllers/admin/inventory-loss-gain.controller", () => h.stub());
vi.mock("@controllers/admin/stock-check.controller", () => h.stub());
vi.mock("@controllers/admin/stock-warning.controller", () => h.stub());
vi.mock("@controllers/store/inventory.controller", () => h.stub());
vi.mock("@controllers/store/trace.controller", () => h.stub());
vi.mock("@controllers/admin/transfer-order.controller", () => h.stub());
vi.mock("@controllers/admin/transfer-execution.controller", () => h.stub());
vi.mock("@controllers/store/transfer-execution.controller", () => h.stub());

// inventory-batch.routes.ts 在**模块加载期**调用 startExpiryScanner()（会起 60s 定时器）⇒ 本测试打桩
vi.mock("../../shared/expiry-scanner", () => ({ startExpiryScanner: () => {} }));

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
import { dataTransferRouter } from "../../routes/data-transfer.routes";
import { inventoryBatchRouter } from "../../routes/inventory-batch.routes";
import { inventoryShareRouter } from "../../routes/inventory-share.routes";
import { adminTraceRouter, miniappTraceRouter } from "../../routes/trace.routes";
import { transferOrderRouter } from "../../routes/transfer-order.routes";
import { warehouseRouter } from "../../routes/warehouse.routes";
import { inventoryLossGainRouter } from "../../routes/inventory-loss-gain.routes";
import { adminStockCheckRouter, storeStockCheckRouter } from "../../routes/stock-check.routes";
import { stockWarningRouter } from "../../routes/stock-warning.routes";
import { storeInventoryRouter } from "../../routes/store-inventory.routes";
import { storeTraceRouter } from "../../routes/store-trace.routes";
import { adminTransferRouter, storeTransferRouter } from "../../routes/transfer.routes";

/**
 * 测试账号：权限串取仓库角色种子（`guard-rbac-wiring.mjs` 的 ROLE_PERMISSIONS_SEED，
 * 来源 079/128/ops-S3-122*），与 `--holders` 复算口径同源。
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
};
const READONLY = 9001;
const SUPER_ADMIN = 9002;

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
}

/**
 * 本批已接名单（**25 行**，逐行判定见台账 §九）。
 * 口径（三重）：① 该端点无「app-mobile 无角色门禁页面」的写调用点；② 有页面调用点时，
 * 该页 `meta.roles`（admin-web/src/router/index.ts）⊆ 权限码持有人集合；
 * ③ **该权限码在生产的实际持有角色**已由凌舟只读核对（R101-S3-198 裁定 §一）——`trace:code` 因此被退回。
 */
const ROWS: Row[] = [
  // ---- data-transfer.routes.ts（2）：系统配置 SystemConfigView.vue:241 [SUPER_ADMIN]
  //      ＋ 商品导入 ProductImport.vue:169 [SUPER_ADMIN, STORE_MANAGER] ----
  { file: "data-transfer.routes.ts", prefix: "/api/admin/data-transfer", router: dataTransferRouter, method: "post", routePath: "/import/customers", path: "/import/customers", perm: "store:transfer" },
  { file: "data-transfer.routes.ts", prefix: "/api/admin/data-transfer", router: dataTransferRouter, method: "post", routePath: "/import/products", path: "/import/products", perm: "store:transfer" },

  // ---- inventory-batch.routes.ts（7）：库存批次 InventoryBatch.vue:142 [SUPER_ADMIN] ----
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "post", routePath: "/batches", path: "/batches", perm: "inventory:create" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "put", routePath: "/batches/:id", path: "/batches/1", perm: "inventory:adjust" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "post", routePath: "/batches/:id/split", path: "/batches/1/split", perm: "inventory:create" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "post", routePath: "/expiry-configs", path: "/expiry-configs", perm: "inventory:create" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "put", routePath: "/expiry-configs/:id", path: "/expiry-configs/1", perm: "inventory:adjust" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "delete", routePath: "/expiry-configs/:id", path: "/expiry-configs/1", perm: "inventory:adjust" },
  { file: "inventory-batch.routes.ts", prefix: "/api/admin/inventory-batch", router: inventoryBatchRouter, method: "put", routePath: "/expiry-alerts/:id/handle", path: "/expiry-alerts/1/handle", perm: "inventory:adjust" },

  // ---- inventory-share.routes.ts（6）：库存共享设置 InventoryShareConfig.vue:141 [SUPER_ADMIN] ----
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "put", routePath: "/settings", path: "/settings", perm: "inventory:adjust" },
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "post", routePath: "/products", path: "/products", perm: "inventory:create" },
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "post", routePath: "/products/batch-add", path: "/products/batch-add", perm: "inventory:create" },
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "post", routePath: "/products/batch-remove", path: "/products/batch-remove", perm: "inventory:create" },
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "put", routePath: "/products/:id", path: "/products/1", perm: "inventory:adjust" },
  { file: "inventory-share.routes.ts", prefix: "/api/admin/inventory-share", router: inventoryShareRouter, method: "delete", routePath: "/products/:id", path: "/products/1", perm: "inventory:adjust" },

  // ---- trace.routes.ts 的 9 条：按凌舟裁定**退回**（原计划的 trace:code 接线作废），见 UNWIRED 的 P 类 ----
  // ---- transfer-order.routes.ts（7）：**全仓零调用点**（无任何前端引用 /api/admin/transfer-orders） ----
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "put", routePath: "/:id", path: "/1", perm: "store:transfer" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "delete", routePath: "/:id", path: "/1", perm: "store:transfer" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "post", routePath: "/:id/approve", path: "/1/approve", perm: "inventory:approve" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "post", routePath: "/:id/reject", path: "/1/reject", perm: "inventory:approve" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "post", routePath: "/:id/confirm-out", path: "/1/confirm-out", perm: "store:transfer" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "post", routePath: "/:id/confirm-in", path: "/1/confirm-in", perm: "store:transfer" },
  { file: "transfer-order.routes.ts", prefix: "/api/admin/transfer-orders", router: transferOrderRouter, method: "post", routePath: "/", path: "/", perm: "store:transfer" },

  // ---- warehouse.routes.ts（3）：系统配置 SystemConfigView.vue:241 [SUPER_ADMIN] ----
  { file: "warehouse.routes.ts", prefix: "/api/admin/warehouses", router: warehouseRouter, method: "post", routePath: "/", path: "/", perm: "inventory:create" },
  { file: "warehouse.routes.ts", prefix: "/api/admin/warehouses", router: warehouseRouter, method: "put", routePath: "/:id", path: "/1", perm: "inventory:adjust" },
  { file: "warehouse.routes.ts", prefix: "/api/admin/warehouses", router: warehouseRouter, method: "delete", routePath: "/:id", path: "/1", perm: "inventory:adjust" },
];

interface UnwiredRow {
  file: string;
  prefix: string;
  router: Router;
  method: Method;
  routePath: string;
  path: string;
  /**
   * B = app-mobile 无角色门禁页面的写调用点（判据不可判定）；
   * A = 与既有页面角色冲突；
   * N = 台账判定有误（免鉴权端点）；
   * P = 待补授权（权限码在生产无门店角色持有，凌舟裁定退回，须另立补授权单）
   */
  reason: "A" | "B" | "N" | "P";
  note: string;
  /** true = 生产挂载无 auth/csrf（`auth:"none"`，如 /api/miniapp/trace） */
  rawMount?: boolean;
}

/** 本域**本批未接**的 32 行（逐条原因见台账 §九；其中 P 类 9 条为凌舟裁定退回的 trace 域）。 */
const UNWIRED: UnwiredRow[] = [
  { file: "inventory-loss-gain.routes.ts", prefix: "/api/admin/inventory", router: inventoryLossGainRouter, method: "post", routePath: "/report-loss-gain", path: "/report-loss-gain", reason: "B", note: "app-mobile 报损报溢页（api/modules/inventory-loss-gain.ts:175/184）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/", path: "/", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:97）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "put", routePath: "/:id", path: "/1", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:102）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/start", path: "/1/start", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:107）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/complete", path: "/1/complete", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:112）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/cancel", path: "/1/cancel", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:117）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/handle-diff", path: "/1/handle-diff", reason: "B", note: "app-mobile 盘点页（api/modules/stock-check.ts:122）" },
  { file: "stock-check.routes.ts", prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, method: "post", routePath: "/:id/items", path: "/1/items", reason: "B", note: "app-mobile 盘点页（api/modules/store.ts:645 同族写调用点）" },
  { file: "stock-check.routes.ts", prefix: "/api/store/stock-checks", router: storeStockCheckRouter, method: "put", routePath: "/:id/items/:itemId", path: "/1/items/1", reason: "B", note: "app-mobile 门店盘点页（api/modules/store.ts:645）" },
  { file: "stock-check.routes.ts", prefix: "/api/store/stock-checks", router: storeStockCheckRouter, method: "post", routePath: "/:id/submit", path: "/1/submit", reason: "B", note: "app-mobile 门店盘点页（api/modules/store.ts:650）" },
  { file: "stock-warning.routes.ts", prefix: "/api/admin/stock-warnings", router: stockWarningRouter, method: "post", routePath: "/config", path: "/config", reason: "B", note: "app-mobile 预警配置（api/modules/stock-warning.ts:72）" },
  { file: "store-inventory.routes.ts", prefix: "/api/store", router: storeInventoryRouter, method: "put", routePath: "/inventory/alerts/:skuId/threshold", path: "/inventory/alerts/1/threshold", reason: "B", note: "app-mobile 门店库存预警（api/modules/store.ts:485）" },
  { file: "store-trace.routes.ts", prefix: "/api/store", router: storeTraceRouter, method: "post", routePath: "/trace/verify", path: "/trace/verify", reason: "A", note: "收银台 CashierView.vue:1273（router/index.ts:259 角色含 STORE_MANAGER / STORE_OPERATOR）不持 trace:code ⇒ 接线即 403" },
  // ---- P 类（9）：trace 域写端点 —— 凌舟裁定退回（生产 t_sys_role.permissions 实测门店角色不含 trace:*） ----
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/configs", path: "/configs", reason: "P", note: "待补授权：trace:* 未被任何门店角色持有（R101-S3-198 裁定 §一）" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "put", routePath: "/configs/:id", path: "/configs/1", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "delete", routePath: "/configs/:id", path: "/configs/1", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/configs/check", path: "/configs/check", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/codes/generate", path: "/codes/generate", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/codes/:traceCode/status", path: "/codes/TRC-1/status", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/recalls", path: "/recalls", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/recalls/:recallNo/execute", path: "/recalls/RC-1/execute", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "put", routePath: "/recalls/:recallNo/complete", path: "/recalls/RC-1/complete", reason: "P", note: "同「待补授权」：trace:code 无生产持有者" },
  { file: "trace.routes.ts", prefix: "/api/admin/trace", router: adminTraceRouter, method: "post", routePath: "/verify", path: "/verify", reason: "B", note: "app-mobile 溯源查询页（api/modules/trace.ts:154）" },
  { file: "trace.routes.ts", prefix: "/api/miniapp/trace", router: miniappTraceRouter, method: "post", routePath: "/c/verify", path: "/c/verify", reason: "N", note: "消费者端扫码校验：routeConfigs 末行 auth:\"none\"，台账 §三.12 判「管理面/是」有误；挂 requirePermission 会因无 req.user 反成 401", rawMount: true },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/", path: "/", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:104）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "put", routePath: "/:id", path: "/1", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:99 详情/提交链路）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/submit", path: "/1/submit", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:109）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/approve", path: "/1/approve", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:114）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/reject", path: "/1/reject", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:119）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/cancel", path: "/1/cancel", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:124）" },
  { file: "transfer.routes.ts", prefix: "/api/admin/transfers", router: adminTransferRouter, method: "post", routePath: "/:id/ship", path: "/1/ship", reason: "B", note: "app-mobile 调拨页（api/modules/transfer.ts:129）" },
  { file: "transfer.routes.ts", prefix: "/api/store/transfers", router: storeTransferRouter, method: "post", routePath: "/:id/receive", path: "/1/receive", reason: "B", note: "app-mobile 门店收货（api/modules/store.ts:680 / transfer.ts:134）" },
];

/** 台账 §三.12 的本域写端点总数（12 文件） = 本批已接 25 + 未接 32 */
const DOMAIN_TOTAL = 57;

function label(row: { file: string; method: Method; routePath: string }) {
  return `${row.file} ${row.method.toUpperCase()} ${row.routePath}`;
}

const HOLDERS = new Map<string, number[]>();
function holdersOf(perm: string): number[] {
  if (!HOLDERS.has(perm)) {
    HOLDERS.set(
      perm,
      Object.entries(USERS)
        .filter(([, u]) => matchPermission(u.perms, perm))
        .map(([id]) => Number(id))
        .sort((a, b) => a - b)
    );
  }
  return HOLDERS.get(perm)!;
}

/** 非持有人（用于反证 403）：管理员角色（SUPER_ADMIN/OPERATION_ADMIN 持 `*`）除外 */
const NON_ADMIN_USERS = Object.entries(USERS)
  .filter(([, u]) => !u.perms.includes("*"))
  .map(([id]) => Number(id));

function buildApp(prefix: string, router: Router, rawMount?: boolean) {
  const app = express();
  app.use(express.json());
  // `auth: "none"` 的挂载（如 /api/miniapp/trace）：生产不加 auth/csrf
  if (rawMount) {
    app.use(prefix, router);
    return app;
  }
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

function call(app: express.Express, method: Method, url: string, uid?: number, rawMount?: boolean) {
  const req = request(app)[method](url);
  if (uid && !rawMount) req.set("x-test-user", String(uid)).set("x-csrf-token", generateCsrfToken(uid));
  return req.send({});
}

const APPS = new Map<string, express.Express>();
function appFor(row: { file: string; prefix: string; router: Router; rawMount?: boolean }) {
  const key = `${row.file}|${row.prefix}`;
  if (!APPS.has(key)) APPS.set(key, buildApp(row.prefix, row.router, row.rawMount));
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

describe("S3-198 · 名单自证", () => {
  it("25 已接 + 32 未接 = 57（= 台账 §三.12 本域写端点总数；返工后退回 trace 域 9 条）", () => {
    expect(ROWS).toHaveLength(25);
    expect(UNWIRED).toHaveLength(32);
    expect(ROWS.length + UNWIRED.length).toBe(DOMAIN_TOTAL);
  });

  it("已接 25 行的逐文件分布（与台账 §九 表一致）", () => {
    const perFile = new Map<string, number>();
    for (const row of ROWS) perFile.set(row.file, (perFile.get(row.file) ?? 0) + 1);
    expect([...perFile.entries()].sort()).toEqual([
      ["data-transfer.routes.ts", 2],
      ["inventory-batch.routes.ts", 7],
      ["inventory-share.routes.ts", 6],
      ["transfer-order.routes.ts", 7],
      ["warehouse.routes.ts", 3],
    ]);
  });

  it("已接 25 行只用到 4 个既有权限码（本批不新立权限点；trace:code 已按裁定退回）", () => {
    expect([...new Set(ROWS.map((r) => r.perm))].sort()).toEqual([
      "inventory:adjust",
      "inventory:approve",
      "inventory:create",
      "store:transfer",
    ]);
  });
});

describe("S3-198 · 形状断言（注册行级判据，踩坑[134]）", () => {
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

  it("整文件子串不足以判定（踩坑[134]）：store-inventory.routes.ts 文件级含 inventory:adjust，但阈值行没有", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "store-inventory.routes.ts"), "utf8");
    expect(src).toContain('requirePermission("inventory:adjust")');
    const lines = registrationLines("store-inventory.routes.ts", "put", "/inventory/alerts/:skuId/threshold");
    expect(lines).toHaveLength(1);
    expect(lines[0].line, "阈值行不得被误判为已接线").not.toContain("requirePermission(");
  });
});

describe("S3-198 · 权限持有人集合复算（生产 matchPermission × 仓库角色种子）", () => {
  it("5 个权限码的持有人集合（逐账号复算，非人工誊写）", () => {
    // inventory:* ⇒ 店长（生产实值）与仓管；store:transfer 只在 store:*（店长）名下，仓管的 transfer:* **不**覆盖
    expect(holdersOf("inventory:create")).toEqual([9002, 9009, 9010, 9011]);
    expect(holdersOf("inventory:adjust")).toEqual([9002, 9009, 9010, 9011]);
    expect(holdersOf("inventory:approve")).toEqual([9002, 9009, 9010, 9011]);
    expect(holdersOf("trace:code")).toEqual([9002, 9010, 9011]);
    expect(holdersOf("store:transfer")).toEqual([9002, 9009, 9010]);
  });

  it("反证：READONLY / FINANCE_STAFF / PURCHASE_STAFF 对 5 个码全不持有", () => {
    for (const uid of [9001, 9006, 9007]) {
      for (const perm of ["inventory:create", "inventory:adjust", "inventory:approve", "trace:code", "store:transfer"]) {
        expect(matchPermission(USERS[uid].perms, perm), `${USERS[uid].name} 不得持有 ${perm}`).toBe(false);
      }
    }
  });

  it("判据有分辨力：仓管的 transfer:* 不覆盖 store:transfer（同一 matcher、不同域互不相通）", () => {
    expect(matchPermission(USERS[9011].perms, "transfer:create")).toBe(true);
    expect(matchPermission(USERS[9011].perms, "store:transfer")).toBe(false);
  });

  it("返工依据（P 类 9 条为何退回）：trace:code 的持有人里**没有门店角色**（店长 / 收银相关角色都不在集合内）", () => {
    // 生产实测口径（R101-S3-198 裁定 §一）：STORE_MANAGER.permissions 不含 trace:*
    expect(holdersOf("trace:code")).toEqual([9002, 9010, 9011]);
    expect(holdersOf("trace:code")).not.toContain(9009); // 店长（生产实值）
    expect(matchPermission(USERS[9009].perms, "trace:code")).toBe(false);
    // 而本批实际保留的 4 个码，店长均持有（这是能接的前提）
    for (const perm of ["inventory:create", "inventory:adjust", "inventory:approve", "store:transfer"]) {
      expect(matchPermission(USERS[9009].perms, perm), `店长应持有 ${perm}`).toBe(true);
    }
  });
});

describe("S3-198 · a) 只读账号被拦（403 且未到达业务层）", () => {
  it.each(ROWS)("$file $method $routePath ⇒ 403 且 msg 指向该权限码", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("403");
    expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    expect(res.body.handler).toBeUndefined();
    expect(h.reached).toEqual([]);
  });
});

describe("S3-198 · b) 持有该权限点的角色照常通过（不锁死既有页面角色）", () => {
  it.each(ROWS)("$file $method $routePath：holders ⇒ 200（到达控制器）", async (row) => {
    for (const uid of holdersOf(row.perm)) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${label(row)} uid=${uid}（${USERS[uid].name}）`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.handler).toBe("string");
    }
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("店长（生产实值，持 store:*/inventory:*）通过全部 25 条 inventory:*/store:transfer 行（页面角色不 403）", async () => {
    const rows = ROWS.filter((r) => r.perm !== "trace:code");
    expect(rows).toHaveLength(25);
    for (const row of rows) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, 9009);
      expect(res.status, label(row)).toBe(200);
    }
  });

  it("仓管（WAREHOUSE_STAFF）通过 inventory:* 与 trace:code 行，但**不**通过 store:transfer 行", async () => {
    for (const row of ROWS.filter((r) => r.perm === "inventory:create" || r.perm === "trace:code").slice(0, 4)) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, 9011);
      expect(res.status, label(row)).toBe(200);
    }
    const transferRow = ROWS.find((r) => r.perm === "store:transfer")!;
    const denied = await call(appFor(transferRow), transferRow.method, `${transferRow.prefix}${transferRow.path}`, 9011);
    expect(denied.status).toBe(403);
    expect(denied.body.msg).toBe("无权限执行此操作，需要权限: store:transfer");
  });
});

describe("S3-198 · c) 反证：非持有人一律 403（不是恒 true 的假门禁）", () => {
  it.each(ROWS)("$file $method $routePath：所有非管理员非持有人 ⇒ 403", async (row) => {
    const holders = holdersOf(row.perm);
    const deniers = NON_ADMIN_USERS.filter((uid) => !holders.includes(uid));
    expect(deniers.length).toBeGreaterThan(0);
    for (const uid of deniers) {
      const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, uid);
      expect(res.status, `${label(row)} uid=${uid}（${USERS[uid].name}）`).toBe(403);
      expect(res.body.msg).toBe(`无权限执行此操作，需要权限: ${row.perm}`);
    }
  });
});

describe("S3-198 · d) 未登录 401（既有行为不变）", () => {
  it.each(ROWS)("$file $method $routePath：无登录态 ⇒ 401", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("401");
    expect(res.body.msg).toBe("未登录");
    expect(h.reached).toEqual([]);
  });
});

describe("S3-198 · e) 范围控制：本域未接的 32 行不被本批拦住（READONLY 仍 200）", () => {
  it.each(UNWIRED)("$file $method $routePath（未接 $reason）：READONLY 仍 200", async (row) => {
    const res = await call(appFor(row), row.method, `${row.prefix}${row.path}`, READONLY, row.rawMount);
    expect(res.status, `${label(row)}（${row.note}）`).toBe(200);
    expect(res.body.success).toBe(true);
    expect(h.reached.length).toBeGreaterThan(0);
  });

  it("未接 32 行的原因分布：B（app-mobile 无角色门禁调用点）21 / P（待补授权，凌舟裁定退回）9 / A（页面角色冲突）1 / N（台账判定有误）1", () => {
    const byReason = (r: string) => UNWIRED.filter((x) => x.reason === r).length;
    expect(byReason("B")).toBe(21);
    expect(byReason("P")).toBe(9);
    expect(byReason("A")).toBe(1);
    expect(byReason("N")).toBe(1);
  });

  it("P 类 9 条全部落在 trace.routes.ts，且该文件**不含任何** requirePermission(（退回已生效）", () => {
    expect(UNWIRED.filter((x) => x.reason === "P").map((x) => x.file)).toEqual(
      Array(9).fill("trace.routes.ts")
    );
    const src = readFileSync(path.join(ROUTES_DIR, "trace.routes.ts"), "utf8");
    expect(src).not.toContain("requirePermission(");
  });

  it("N 类 1 行锚点：/api/miniapp/trace/c/verify 的挂载为 auth:\"none\"（消费者端，非管理面）", () => {
    const src = readFileSync(path.join(ROUTES_DIR, "trace.routes.ts"), "utf8");
    expect(src).toContain('prefix: "/api/miniapp/trace", router: miniappTraceRouter, auth: "none"');
  });
});
