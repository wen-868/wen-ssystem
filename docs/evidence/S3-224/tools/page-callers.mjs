#!/usr/bin/env node
/**
 * S3-224 · 第二遍：把「api 模块封装」解析成「页面调用点」
 *
 * 第一遍 tools/callers.mjs 只能看到 URL 出现的行（多在 api 模块里）；
 * 真实使用者要看**页面**（.vue）调用了哪个封装函数。本脚本：
 *   ① 对每条端点，取它命中的 api 模块行；
 *   ② 从该行向上回溯，找出**所在函数名**（`export async function NAME(` 或对象字面量里的 `async NAME(`）；
 *   ③ 在全部 .vue 里搜 `NAME(` 调用 ⇒ 得到页面调用点（文件:行）。
 *
 * 用法：node docs/evidence/S3-224/tools/page-callers.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["admin-web/src", "app-mobile/src", "miniapp/src", "saas-admin/src", "website/src"];
const API_DIRS = ["admin-web/src/api", "app-mobile/src/api", "miniapp/src/api", "saas-admin/src/api"];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

const ENDPOINTS = [
  ["admin-marketing-flash-sale.routes.ts", "PUT", "/api/admin/marketing/flash-sales/:id", "flash-sales/${"],
  ["admin-marketing-flash-sale.routes.ts", "DELETE", "/api/admin/marketing/flash-sales/:id", "flash-sales/${"],
  ["admin-order.routes.ts", "POST", "/api/admin/orders/batch-status", "batch-status"],
  ["admin-order.routes.ts", "POST", "/api/admin/orders/:orderNo/cancel", "orders/${"],
  ["admin-order.routes.ts", "PUT", "/api/admin/orders/:orderNo/remark", "orders/${"],
  ["admin-order.routes.ts", "PUT", "/api/admin/orders/:orderNo/status", "orders/${"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/preview", "quote-push/preview"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/", "quote-push"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/:id/push", "quote-push/${"],
  ["admin-quote-push.routes.ts", "POST", "/api/admin/quote-push/:id/cancel", "quote-push/${"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/approve", "aftersales/${"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/reject", "aftersales/${"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/confirm-receipt", "confirm-receipt"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/inspect", "aftersales/${"],
  ["aftersale.routes.ts", "POST", "/api/admin/aftersales/:id/complete", "aftersales/${"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/add", "cart/add"],
  ["cart.routes.ts", "PUT", "/api/miniapp/cart/items/:skuId", "cart/items"],
  ["cart.routes.ts", "DELETE", "/api/miniapp/cart/items/:skuId", "cart/items"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/clear", "cart/clear"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/checkout/preview", "checkout/preview"],
  ["cart.routes.ts", "POST", "/api/miniapp/cart/checkout/create", "checkout/create"],
  ["commerce-fix.routes.ts", "DELETE", "/api/admin/consumer-addresses/:id", "consumer-addresses/${"],
  ["commerce-fix.routes.ts", "PUT", "/api/admin/bills/:id", "bills/${"],
  ["commerce-fix.routes.ts", "DELETE", "/api/admin/bills/:id", "bills/${"],
  ["commerce-fix.routes.ts", "POST", "/api/admin/bills/:id/void", "bills/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/orders/:orderNo/status", "orders/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/routing-rules", "routing-rules"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/routing-rules/:id", "routing-rules/${"],
  ["instant-retail-admin-ops.routes.ts", "DELETE", "/api/admin/instant-retail/routing-rules/:id", "routing-rules/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/exceptions/:id/handle", "exceptions/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/shelf", "instant-retail/shelf"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/shelf/:id", "shelf/${"],
  ["instant-retail-admin-ops.routes.ts", "DELETE", "/api/admin/instant-retail/shelf/:id", "shelf/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/deliveries/:deliveryId/assign", "deliveries/${"],
  ["instant-retail-admin-ops.routes.ts", "PUT", "/api/admin/instant-retail/deliveries/:deliveryId/status", "deliveries/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/reviews/:id/reply", "reviews/${"],
  ["instant-retail-admin-ops.routes.ts", "POST", "/api/admin/instant-retail/reviews/sync", "reviews/sync"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs", "instant-retail/configs"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/test", "configs/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/sync-orders", "sync-orders"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/configs/:platform/sync-products", "sync-products"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/configs/:platform", "configs/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/shop-config", "shop-config"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/categories", "instant-retail/categories"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/categories/:id", "categories/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/categories/:id", "categories/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/products", "instant-retail/products"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/products/:id", "products/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/products/:id", "products/${"],
  ["instant-retail-admin-platform.routes.ts", "POST", "/api/admin/instant-retail/banners", "instant-retail/banners"],
  ["instant-retail-admin-platform.routes.ts", "PUT", "/api/admin/instant-retail/banners/:id", "banners/${"],
  ["instant-retail-admin-platform.routes.ts", "DELETE", "/api/admin/instant-retail/banners/:id", "banners/${"],
  ["order-exception.routes.ts", "POST", "/api/admin/order-exceptions", "admin/order-exceptions"],
  ["order-exception.routes.ts", "PUT", "/api/admin/order-exceptions/:id(\\d+)/status", "order-exceptions/${"],
  ["order-exception.routes.ts", "PUT", "/api/admin/order-exceptions/:id(\\d+)", "order-exceptions/${"],
  ["order-timeout.routes.ts", "POST", "/api/admin/order-timeout/configs", "order-timeout/configs"],
  ["order-timeout.routes.ts", "PUT", "/api/admin/order-timeout/configs/:id", "order-timeout/configs/${"],
  ["order-timeout.routes.ts", "DELETE", "/api/admin/order-timeout/configs/:id", "order-timeout/configs/${"],
  ["position.routes.ts", "POST", "/api/admin/positions/", "/admin/positions"],
  ["position.routes.ts", "PUT", "/api/admin/positions/:id", "/admin/positions/${"],
  ["position.routes.ts", "DELETE", "/api/admin/positions/:id", "/admin/positions/${"],
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/", "/admin/sale-returns"],
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/:returnNo/approve", "sale-returns/${"],
  ["sale-return.routes.ts", "POST", "/api/admin/sale-returns/:returnNo/reject", "sale-returns/${"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/accept", "orders/${"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/start-delivery", "orders/${"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/complete-delivery", "orders/${"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/reject", "orders/${"],
  ["store-order.routes.ts", "POST", "/api/store/orders/:orderNo/cancel", "orders/${"],
  ["store-order.routes.ts", "POST", "/api/store/hold-orders/", "hold-orders"],
  ["store-order.routes.ts", "POST", "/api/store/hold-orders/:holdNo/restore", "hold-orders/${"],
  ["store-order.routes.ts", "DELETE", "/api/store/hold-orders/:holdNo", "hold-orders/${"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/", "/store/sale-bills"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/collection-link", "collection-link"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/offline-payment", "offline-payment"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/payment", "/sale-bills/${"],
  ["store-sale-bill.routes.ts", "POST", "/api/store/sale-bills/:billNo/pay-by-code", "pay-by-code"],
  ["store-shift.routes.ts", "POST", "/api/store/shift/settle", "/shift/settle"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/", "/store/shifts"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/:shiftNo/check", "shifts/${"],
  ["store-shift.routes.ts", "POST", "/api/store/shifts/:shiftNo/close", "shifts/${"],
];

function walk(dir, out = [], filter = /\.(ts|vue|js|mjs|tsx)$/) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out, filter);
    else if (filter.test(e.name)) out.push(p);
  }
  return out;
}

const ALL = [];
const VUES = [];
const APIS = [];
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  if (!existsSync(abs)) continue;
  ALL.push(...walk(abs));
}
for (const f of ALL) {
  if (f.endsWith(".vue")) VUES.push(f);
  else if (API_DIRS.some((a) => relative(ROOT, f).split(sep).join("/").startsWith(a))) APIS.push(f);
}

const CACHE = new Map();
function linesOf(f) {
  if (!CACHE.has(f)) CACHE.set(f, readFileSync(f, "utf8").split(/\r?\n/));
  return CACHE.get(f);
}
const rel = (f) => relative(ROOT, f).split(sep).join("/");
const FN_RE = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/;
const STOP_RE = /^\s*(?:const|let|var|return|if|for|while|switch|throw|await|@|\.|\/\/|\*)/;

/** 从命中行向上回溯，取所在函数名 */
function enclosingFn(lines, hitIdx) {
  for (let i = hitIdx; i >= 0 && i > hitIdx - 60; i--) {
    const l = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
    if (STOP_RE.test(l)) continue;
    const m = l.match(FN_RE);
    if (m) return m[1];
  }
  return null;
}

console.log("# 第二遍：端点 → api 封装函数 → 页面（.vue）调用点\n");
console.log(`扫描：.vue ${VUES.length} 个 ／ api 模块 ${APIS.length} 个（目录 ${API_DIRS.join(", ")}）\n`);

let idx = 0;
for (const [file, method, path, fragment] of ENDPOINTS) {
  idx++;
  const fns = new Map(); // fnName -> [apiFile:line]
  for (const f of APIS) {
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.includes(fragment)) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
      const fn = enclosingFn(lines, i) ?? "(未识别)";
      if (!fns.has(fn)) fns.set(fn, []);
      fns.get(fn).push(`${rel(f)}:${i + 1}`);
    }
  }
  const pages = [];
  for (const fn of fns.keys()) {
    if (fn === "(未识别)") continue;
    // ⚠️ 不能用 `[^\w.]` —— `storeApi.createHoldOrder(` 这类「对象.方法」调用里，
    //    方法名前的字符正是 `.`，会被错误排除（首版即因此漏掉全部 app-mobile 调用点）。
    //    改用 `\b`（词边界）：`storeApi.createHoldOrder(` / `createHoldOrder(` 均能命中。
    const re = new RegExp(`\\b${fn}\\s*\\(`);
    for (const v of VUES) {
      const lines = linesOf(v);
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*(\/\/|\*|\/\*)/.test(lines[i])) continue;
        if (re.test(lines[i])) pages.push(`${rel(v)}:${i + 1} (${fn})`);
      }
    }
  }
  const uniqPages = [...new Set(pages)];
  console.log(`## ${idx}. ${method} ${path}  ←  ${file}`);
  console.log(`   api 封装：${fns.size ? [...fns.keys()].join(" / ") : "（无）"}`);
  console.log(`   页面调用点：${uniqPages.length ? uniqPages.join(" ; ") : "**无**"}`);
  console.log("");
}
