#!/usr/bin/env node
/**
 * S3-233 · 把本批**已接线**的 57 条端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，名单写死在下方 WIRED 常量里（名单来源：
 * `node docs/evidence/S3-233/tools/s3238-wired-map.mjs` —— 门端点 ∩ 台账 gaps ∩ 扫描 hasPermission=true，可复算），
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * ⚠️ 反测顺序（派单规范 §九.1）：**先跑本脚本，再注入违规**，否则摘掉接线只会产出"已登记的缺口" ⇒ `--strict` 仍绿（假绿）。
 *
 * 用法：node docs/evidence/S3-233/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";
const EXPECT_REMOVED = 57;

const WIRED = {
  "admin-marketing-coupon.routes.ts": [
    "POST /api/admin/marketing/coupons/templates",
    "POST /api/admin/marketing/coupons/templates/:id/pause",
  ],
  "admin-marketing-full-reduction.routes.ts": [
    "POST /api/admin/marketing/full-reductions/:id/activate",
    "POST /api/admin/marketing/full-reductions/:id/pause",
    "DELETE /api/admin/marketing/full-reductions/:id",
  ],
  "admin-order.routes.ts": ["PUT /api/admin/orders/:orderNo/status"],
  "admin-product.routes.ts": [
    "PUT /api/admin/products/:id",
    "PUT /api/admin/products/:skuId/price",
    "PUT /api/admin/products/skus/:skuId",
    "POST /api/admin/products/skus/:skuId/units",
    "PUT /api/admin/products/skus/:skuId/units/:unitId",
    "DELETE /api/admin/products/skus/:skuId/units/:unitId",
    "PUT /api/admin/products/:spuId/marketing-tags",
    "POST /api/admin/products/upload-image",
  ],
  "admin-staff.routes.ts": [
    "POST /api/admin/staff",
    "PUT /api/admin/staff/:id",
    "PUT /api/admin/staff/:id/disable",
    "POST /api/admin/staff/:id/restore",
  ],
  "bank-account.routes.ts": [
    "POST /api/admin/bank-accounts/",
    "POST /api/admin/bank-accounts/:id/close",
  ],
  "category.routes.ts": [
    "POST /api/admin/products/categories/",
    "PUT /api/admin/products/categories/:id",
    "PUT /api/admin/products/categories/:id/sort",
    "DELETE /api/admin/products/categories/:id",
  ],
  "inventory-loss-gain.routes.ts": ["POST /api/admin/inventory/report-loss-gain"],
  "purchase-in-stock.routes.ts": ["POST /api/admin/purchase-in-stocks/"],
  "purchase-payment.routes.ts": ["POST /api/admin/purchase-payments/"],
  "purchase-return.routes.ts": ["POST /api/admin/purchase-returns/"],
  "purchase.routes.ts": ["POST /api/admin/purchase-orders/"],
  "rbac.routes.ts": [
    "POST /api/admin/system/roles/",
    "PUT /api/admin/system/roles/:id",
    "DELETE /api/admin/system/roles/:id",
  ],
  "receipt.routes.ts": ["POST /api/admin/receipts/"],
  "reconciliation.routes.ts": [
    "POST /api/admin/reconciliation/customer/:customerId/confirm",
    "POST /api/admin/reconciliation/supplier/:supplierId/confirm",
  ],
  "stock-check.routes.ts": [
    "POST /api/admin/stock-checks/",
    "PUT /api/admin/stock-checks/:id",
    "POST /api/admin/stock-checks/:id/start",
    "POST /api/admin/stock-checks/:id/complete",
    "POST /api/admin/stock-checks/:id/cancel",
    "POST /api/admin/stock-checks/:id/handle-diff",
    "POST /api/admin/stock-checks/:id/items",
    "PUT /api/store/stock-checks/:id/items/:itemId",
    "POST /api/store/stock-checks/:id/submit",
  ],
  "stock-warning.routes.ts": ["POST /api/admin/stock-warnings/config"],
  "store-inventory.routes.ts": ["PUT /api/store/inventory/alerts/:skuId/threshold"],
  "store-order.routes.ts": [
    "POST /api/store/orders/:orderNo/start-delivery",
    "POST /api/store/hold-orders/",
  ],
  "store-sale-bill.routes.ts": ["POST /api/store/sale-bills/:billNo/offline-payment"],
  "transfer.routes.ts": [
    "POST /api/admin/transfers/",
    "PUT /api/admin/transfers/:id",
    "POST /api/admin/transfers/:id/submit",
    "POST /api/admin/transfers/:id/approve",
    "POST /api/admin/transfers/:id/reject",
    "POST /api/admin/transfers/:id/cancel",
    "POST /api/admin/transfers/:id/ship",
    "POST /api/store/transfers/:id/receive",
  ],
};

const json = JSON.parse(readFileSync(PATH, "utf8"));
const before = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) before.endpoints += list.length;

let removed = 0;
for (const [file, paths] of Object.entries(WIRED)) {
  const list = json.gaps[file];
  if (!list) throw new Error(`台账里没有该文件：${file}`);
  for (const p of paths) {
    const i = list.indexOf(p);
    if (i === -1) throw new Error(`台账里没有该端点：${file} | ${p}`);
    list.splice(i, 1);
    removed++;
  }
  if (list.length === 0) delete json.gaps[file];
}

const after = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) after.endpoints += list.length;

if (removed !== EXPECT_REMOVED) throw new Error(`预期移除 ${EXPECT_REMOVED} 条，实际 ${removed} 条`);
if (before.endpoints - after.endpoints !== EXPECT_REMOVED) throw new Error("计数不守恒");

json._counts = {
  ...json._counts,
  files: after.files,
  endpoints: after.endpoints,
  wiredEndpoints: json._counts.wiredEndpoints + EXPECT_REMOVED,
  wiredPermOccurrences: json._counts.wiredPermOccurrences + EXPECT_REMOVED,
};
json._lastUpdate = "2026-10-16 S3-233 B 类收编第一批：57 条已接线，从 gaps 移除（378 → 321）";
json._s3233_note =
  "S3-233（第 43 项续 · B 类收编第一批）把 S3-230（PR #356）入口权限门所覆盖的 **58 条唯一端点**（26 道门 / 60 端点行）" +
  "按门注册表挂上既有权限码 —— 其中 57 条此前是无授权缺口（本条机读台账逐条移除：378 → 321 / 113 → 92 文件），" +
  "第 58 条 `POST /api/admin/orders/:orderNo/cancel` 早已由 S3-209 挂 `sale:void`（本次仅新增跨层一致性断言，不动业务代码）。" +
  "逐条判定、依据门、落地码与「哪些门前端仍为 registered ⇒ 不接」见 docs/tasks/R101-RBAC接线缺口清单.md §十八；" +
  "跨层一致性断言（门注册表 ↔ 后端接线）见 backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts。" +
  "移除的是**同一批端点**的登记（接线前确有缺口），不是新缺口洗绿；consumerEnd / readOnlyPosts 两条口径本批一条未动。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(
  `移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`
);
