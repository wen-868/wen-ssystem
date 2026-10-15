#!/usr/bin/env node
/**
 * S3-220 · 商品域 45 条写端点「前端调用面」清点（只读）
 *
 * 目的：为每一条端点给出「谁在用」的**可复跑证据**（文件:行），
 *      并把调用点分成三类，供「零回归」判定使用：
 *        ① page   = .vue 页面里的真实调用（有页面 ⇒ 有角色门）
 *        ② api    = 前端 api 模块里的封装（可能没有任何页面使用）
 *        ③ other  = 测试 / 脚本 / 文档
 *
 * 用法：node docs/evidence/S3-220/tools/callers.mjs
 * 输出：markdown 表格到 stdout（落盘见 02-callers.txt）
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["admin-web/src", "app-mobile/src", "miniapp/src", "saas-admin/src"];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

const ENDPOINTS = [
  ["admin-library.routes.ts", "POST", "/api/admin/library/lookup", ["/admin/library/lookup"]],
  ["admin-product.routes.ts", "POST", "/api/admin/products/upload-image", ["products/upload-image"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:id/status", ["/status"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:id", ["`/admin/products/", "/admin/products/"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:id/disable", ["/disable"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:skuId/price", ["/price`", "/price\"", "/price'"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/skus/:skuId/barcode", ["/barcode"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/skus/:skuId", ["products/skus/"]],
  ["admin-product.routes.ts", "POST", "/api/admin/products/skus/:skuId/units", ["/units`", "/units\""]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/skus/:skuId/units/:unitId", ["/units/"]],
  ["admin-product.routes.ts", "DELETE", "/api/admin/products/skus/:skuId/units/:unitId", ["/units/"]],
  ["admin-product.routes.ts", "POST", "/api/admin/products/import", ["products/import"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:spuId/marketing-tags", ["marketing-tags"]],
  ["admin-product.routes.ts", "PUT", "/api/admin/products/:id/warning-threshold", ["warning-threshold"]],
  ["brand.routes.ts", "POST", "/api/admin/brands/", ["/admin/brands"]],
  ["brand.routes.ts", "PUT", "/api/admin/brands/:id", ["/admin/brands/"]],
  ["brand.routes.ts", "DELETE", "/api/admin/brands/:id", ["/admin/brands/"]],
  ["category.routes.ts", "POST", "/api/admin/products/categories/", ["products/categories"]],
  ["category.routes.ts", "PUT", "/api/admin/products/categories/:id", ["products/categories/"]],
  ["category.routes.ts", "DELETE", "/api/admin/products/categories/:id", ["products/categories/"]],
  ["category.routes.ts", "PUT", "/api/admin/products/categories/:id/sort", ["/sort"]],
  ["price.routes.ts", "POST", "/api/admin/prices/best-price", ["best-price"]],
  ["price.routes.ts", "POST", "/api/admin/prices/batch/preview", ["batch/preview"]],
  ["product-bundle.routes.ts", "POST", "/api/admin/product-bundles", ["product-bundles"]],
  ["product-bundle.routes.ts", "PUT", "/api/admin/product-bundles/:id", ["product-bundles/"]],
  ["product-bundle.routes.ts", "DELETE", "/api/admin/product-bundles/:id", ["product-bundles/"]],
  ["product-bundle.routes.ts", "POST", "/api/admin/product-bundles/:id/publish", ["/publish"]],
  ["product-bundle.routes.ts", "POST", "/api/admin/product-bundles/:id/unpublish", ["/unpublish"]],
  ["product-bundle.routes.ts", "POST", "/api/admin/combo-products", ["combo-products"]],
  ["product-bundle.routes.ts", "PUT", "/api/admin/combo-products/:id", ["combo-products/"]],
  ["product-bundle.routes.ts", "DELETE", "/api/admin/combo-products/:id", ["combo-products/"]],
  ["product-marketing-tag.routes.ts", "POST", "/api/admin/product-tags/", ["/admin/product-tags"]],
  ["product-marketing-tag.routes.ts", "PUT", "/api/admin/product-tags/:id", ["product-tags/"]],
  ["product-marketing-tag.routes.ts", "DELETE", "/api/admin/product-tags/:id", ["product-tags/"]],
  ["product-review.routes.ts", "POST", "/api/admin/product-reviews/", ["/admin/product-reviews"]],
  ["product-review.routes.ts", "POST", "/api/admin/product-reviews/:id/approve", ["/approve"]],
  ["product-review.routes.ts", "POST", "/api/admin/product-reviews/:id/reject", ["/reject"]],
  ["product-review.routes.ts", "POST", "/api/admin/product-reviews/batch-approve", ["batch-approve"]],
  ["product-review.routes.ts", "POST", "/api/admin/product-reviews/batch-reject", ["batch-reject"]],
  ["unit-group.routes.ts", "POST", "/api/admin/unit-groups/", ["/admin/unit-groups"]],
  ["unit-group.routes.ts", "PUT", "/api/admin/unit-groups/:id", ["unit-groups/"]],
  ["unit-group.routes.ts", "DELETE", "/api/admin/unit-groups/:id", ["unit-groups/"]],
  ["unit.routes.ts", "POST", "/api/admin/units/", ["/admin/units"]],
  ["unit.routes.ts", "PUT", "/api/admin/units/:id", ["/admin/units/"]],
  ["unit.routes.ts", "DELETE", "/api/admin/units/:id", ["/admin/units/"]],
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

const isVue = (f) => f.endsWith(".vue");
const rel = (f) => relative(ROOT, f).split(sep).join("/");

console.log(`扫描目录：${SCAN_DIRS.join(", ")}｜文件数 ${FILES.length}\n`);
console.log("| # | 端点 | 页面调用点（.vue） | api 模块调用点 | 判定 |");
console.log("|--:|:--|:--|:--|:--|");

let n = 0;
for (const [file, method, path, patterns] of ENDPOINTS) {
  n++;
  const pageHits = [];
  const apiHits = [];
  for (const f of FILES) {
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!patterns.some((p) => l.includes(p))) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
      const tag = isVue(f) ? "page" : "api";
      const s = `${rel(f)}:${i + 1}`;
      (tag === "page" ? pageHits : apiHits).push(s);
    }
  }
  const verdict =
    pageHits.length > 0 ? "**有页面调用点**" : apiHits.length > 0 ? "仅 api 封装（页面未用）" : "**全仓无调用点**";
  console.log(
    `| ${n} | \`${method} ${path}\` | ${pageHits.length ? pageHits.join("<br>") : "—"} | ${apiHits.length ? apiHits.join("<br>") : "—"} | ${verdict} |`
  );
}
console.log(`\n合计端点：${ENDPOINTS.length}`);
