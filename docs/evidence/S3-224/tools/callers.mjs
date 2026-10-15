#!/usr/bin/env node
/**
 * S3-224 · 销售域 87 条「仍缺口」写端点「前端调用面」清点（只读）
 *
 * 目的：为每条端点给出「谁在用」的**可复跑证据**（文件:行 + 方法），
 *      供「零回归」判定（页面角色 / 菜单码 ⊆ 权限码持有人）使用。
 *
 * 判定口径（与 S3-223 §13.1③ 一致）：
 *   · .vue 页面里的写调用点 ⇒ 该页的**入口**决定使用者集合是否可枚举；
 *   · .ts 里的封装（api 模块）但无页面使用 ⇒ 记「仅 api 封装（页面未用）」；
 *   · 全仓 0 命中 ⇒ 记「全仓无调用点」。
 *
 * 用法：node docs/evidence/S3-224/tools/callers.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["admin-web/src", "app-mobile/src", "miniapp/src", "saas-admin/src", "website/src"];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

/** [文件, 方法, 路径, 行内必须出现的 URL 片段] */
const ENDPOINTS = [
  // ── admin-marketing-flash-sale.routes.ts ──
  ["admin-marketing-flash-sale.routes.ts", "PUT", "/api/admin/marketing/flash-sales/:id", "flash-sales/${"],
  ["admin-marketing-flash-sale.routes.ts", "DELETE", "/api/admin/marketing/flash-sales/:id", "flash-sales/${"],
  // ── admin-order.routes.ts ──
  ["admin-order.routes.ts", "POST", "/api/admin/orders/batch-status", "batch-status"],
  ["admin-order.routes.ts", "POST", "/api/admin/orders/:orderNo/cancel", "/cancel"],
  ["admin-order.routes.ts", "PUT", "/api/admin/orders/:orderNo/remark", "/remark"],
  ["admin-order.routes.ts", "PUT", "/api/admin/orders/:orderNo/status", "orders/${"],
  // ── admin-quote-push.routes.ts ──
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/preview", "/quote-push/preview"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/", "/admin/quote-push"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/:id/push", "/push"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/:id/cancel", "/cancel"],
  // ── aftersale.routes.ts（管理面 5 条；小程序 4 条已是 consumerEnd） ──
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/approve", "aftersales"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/reject", "aftersales"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/confirm-receipt", "confirm-receipt"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/inspect", "aftersales"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/complete", "aftersales"],
  // ── cart.routes.ts（小程序购物车 6 条，声明式消费者认证） ──
  ["cart.routes.ts", "POST", "/api/miniapp/cart/add", "/cart/add"],
  ["cart.routes.ts", "PUT", "/api/miniapp/cart/items/:skuId", "/cart/items"],
  ["cart.routes.ts", "DELETE", "/api/miniapp/cart/items/:skuId", "/cart/items"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/clear", "/cart/clear"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/checkout/preview", "checkout/preview"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/checkout/create", "checkout/create"],
  // ── commerce-fix.routes.ts ──
  ["commerce-fix.routes.ts", "DELETE", "/api/admin/consumer-addresses/:id", "consumer-addresses"],
  ["commerce-fix.routes.ts", "PUT", "/api/admin/bills/:id", "bills/${"],
  ["commerce-fix.routes.ts", "DELETE", "/api/admin/bills/:id", "bills/${"],
  ["commerce-fix.routes.ts", "POST", "/api/admin/bills/:id/void", "/void"],
  // ── instant-retail-admin-ops.routes.ts ──
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/orders/:orderNo/status", "orders/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/routing-rules", "routing-rules"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/routing-rules/:id", "routing-rules/${"],
  ["instant-retail-admin-ops.routes.ts", "DELETE", "/api/admin/instant-retail/routing-rules/:id", "routing-rules/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/exceptions/:id/handle", "exceptions/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/shelf", "/instant-retail/shelf"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/shelf/:id", "shelf/${"],
  ["instant-retail-admin-ops.routes.ts", "DELETE", "/api/admin/instant-retail/shelf/:id", "shelf/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/deliveries/:deliveryId/assign", "deliveries/${"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/deliveries/:deliveryId/status", "deliveries/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/reviews/:id/reply", "reviews/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/reviews/sync", "reviews/sync"],
  // ── instant-retail-admin-platform.routes.ts ──
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs", "/instant-retail/configs"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/test", "configs/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/sync-orders", "sync-orders"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/sync-products", "sync-products"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/configs/:platform", "configs/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/shop-config", "shop-config"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/categories", "/instant-retail/categories"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/categories/:id", "categories/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/categories/:id", "categories/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/products", "/instant-retail/products"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/products/:id", "products/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/products/:id", "products/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/banners", "/instant-retail/banners"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/banners/:id", "banners/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/banners/:id", "banners/${"],
  // ── instant-retail-store.routes.ts ──
  ["instant-retail-store.routes.ts", "POST", "/api/store/instant-retail/orders/:platformOrderId/confirm", "/confirm"],
  ["instant-retail-store.routes.ts", "POST", "/api/store/instant-retail/orders/:platformOrderId/cancel", "/cancel"],
  ["instant-retail-store.routes.ts", "POST", "/api/store/instant-retail/orders/:platformOrderId/start-delivery", "start-delivery"],
  ["instant-retail-store.routes.ts", "POST", "/api/store/instant-retail/orders/:platformOrderId/complete-delivery", "complete-delivery"],
  // ── instant-retail-webhook.routes.ts（公开） ──
  ["instant-retail-webhook.routes.ts", "POST", "/api/instant-retail/webhook/jd", "webhook"],
  ["instant-retail-webhook.routes.ts", "POST", "/api/instant-retail/webhook/meituan", "webhook"],
  ["instant-retail-webhook.routes.ts", "POST", "/api/instant-retail/webhook/eleme", "webhook"],
  // ── order-exception.routes.ts ──
  ["order-exception.routes.ts", "POST", "/api/admin/order-exceptions", "/admin/order-exceptions"],
  ["order-exception.routes.ts", "PUT", "/api/admin/order-exceptions/:id(\\d+)/status", "/status"],
  ["order-exception.routes.ts", "PUT", "/api/admin/order-exceptions/:id(\\d+)", "order-exceptions/${"],
  // ── order-timeout.routes.ts ──
  ["order-timeout.routes.ts", "POST", "/api/admin/order-timeout/configs", "/admin/order-timeout/configs"],
  ["order-timeout.routes.ts", "PUT", "/api/admin/order-timeout/configs/:id", "configs/${"],
  ["order-timeout.routes.ts", "DELETE", "/api/admin/order-timeout/configs/:id", "configs/${"],
  // ── position.routes.ts ──
  ["position.routes.ts", "POST", "/api/admin/positions/", "/admin/positions"],
  ["position.routes.ts", "PUT", "/api/admin/positions/:id", "/admin/positions/"],
  ["position.routes.ts", "DELETE", "/api/admin/positions/:id", "/admin/positions/"],
  // ── sale-return.routes.ts（POST / 已被 G0/G1/G2 锁定，不接） ──
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/", "/sale-returns"],
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/:returnNo/approve", "/approve"],
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/:returnNo/reject", "/reject"],
  // ── store-order.routes.ts ──
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/accept", "/accept"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/start-delivery", "start-delivery"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/complete-delivery", "complete-delivery"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/reject", "/reject"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/cancel", "/cancel"],
  ["store-order.routes.ts", "POST", "/api/store/hold-orders/", "/hold-orders"],
  ["store-order.routes.ts", "POST", "/api/store/hold-orders/:holdNo/restore", "/restore"],
  ["store-order.routes.ts", "DELETE", "/api/store/hold-orders/:holdNo", "/hold-orders/${"],
  // ── store-sale-bill.routes.ts（payment 已被 G0 锁定，不接） ──
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/", "/sale-bills"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/collection-link", "collection-link"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/offline-payment", "offline-payment"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/payment", "/payment"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/pay-by-code", "pay-by-code"],
  // ── store-shift.routes.ts ──
  ["store-shift.routes.ts", "POST", "/api/store/shift/settle", "/shift/settle"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/", "/store/shifts"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/:shiftNo/check", "/check"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/:shiftNo/close", "/close"],
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|vue|js|mjs|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = [];
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  if (existsSync(abs)) FILES.push(...walk(abs));
}
const CACHE = new Map();
function linesOf(f) {
  if (!CACHE.has(f)) CACHE.set(f, readFileSync(f, "utf8").split(/\r?\n/));
  return CACHE.get(f);
}
const rel = (f) => relative(ROOT, f).split(sep).join("/");
const isVue = (f) => f.endsWith(".vue");
/** 行内是否出现「方法调用」（put(/post(/delete(/del(/patch(，含 api. 前缀） */
function hasMethod(line, method) {
  const m = method.toLowerCase();
  const re = new RegExp(`(?:^|[^\\w])(?:${m}|${m === "delete" ? "del" : m})\\s*\\(`, "i");
  return re.test(line);
}

console.log(`扫描目录：${SCAN_DIRS.join(", ")}｜文件数 ${FILES.length}`);
console.log(`（行内判据：URL 片段命中 且 同一行出现对应 HTTP 方法调用）\n`);
console.log("| # | 端点 | 页面调用点（.vue） | api 模块调用点 | 判定 |");
console.log("|--:|:--|:--|:--|:--|");

let n = 0;
const tally = { page: 0, apiOnly: 0, none: 0 };
for (const [file, method, path, fragment] of ENDPOINTS) {
  n++;
  const pageHits = [];
  const apiHits = [];
  for (const f of FILES) {
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.includes(fragment)) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
      if (!hasMethod(l, method)) continue;
      const s = `${rel(f)}:${i + 1}`;
      (isVue(f) ? pageHits : apiHits).push(s);
    }
  }
  // 去重：同一行可能同时被多条端点命中（如 PUT/DELETE 同路径），保持原样以便人工判读
  let verdict;
  if (pageHits.length > 0) {
    verdict = "**有页面调用点**";
    tally.page++;
  } else if (apiHits.length > 0) {
    verdict = "仅 api 封装（页面未用）";
    tally.apiOnly++;
  } else {
    verdict = "**全仓无调用点**";
    tally.none++;
  }
  console.log(
    `| ${n} | \`${method} ${path}\` | ${pageHits.length ? [...new Set(pageHits)].join("<br>") : "—"} | ${
      apiHits.length ? [...new Set(apiHits)].join("<br>") : "—"
    } | ${verdict} |`
  );
}
console.log(`\n合计端点：${ENDPOINTS.length}`);
console.log(`判定汇总：有页面调用点 ${tally.page} ／ 仅 api 封装 ${tally.apiOnly} ／ 全仓无调用点 ${tally.none}`);
console.log(`\n⚠️ 局限：仅做「同一行」匹配 ⇒ 跨行调用（URL 与方法不在同一行）会漏；`);
console.log(`   故每条端点的最终判定另由 rg 全仓复核（见 03-callers-crosscheck.txt）。`);
