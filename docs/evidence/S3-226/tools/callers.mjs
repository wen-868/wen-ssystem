#!/usr/bin/env node
/**
 * S3-226 · 营销域 89 条写端点「前端调用面」清点（只读）
 *
 * 目的：为每条端点给出「谁在用」的可复跑证据（文件:行 + 方法 + 所在 api 封装函数），
 *      供「使用者集合是否可枚举 / 页面角色 ⊆ 权限码持有者」判定使用。
 *
 * 口径：
 *   · 第一遍：在 6 个前端 src 下搜「URL 片段命中 且 同一行出现对应 HTTP 方法调用」的行；
 *   · 第二遍：命中的 api 模块行 → 向上回溯所在函数名 → 在 .vue 里搜该函数名 ⇒ 页面调用点；
 *   · 片段全部取自**前端源码里真实出现的 URL 文本**；若前端打的路径与后端注册路径不同
 *     （路径错配），两边的片段都会列出 ⇒ 便于判定「这条端点今天到底有没有有效调用点」。
 *
 * 用法：node docs/evidence/S3-226/tools/callers.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  "admin-web/src",
  "app-mobile/src",
  "miniapp/src",
  "saas-admin/src",
  "website/src",
  "platform-miniapp/src",
];
const API_DIRS = [
  "admin-web/src/api",
  "app-mobile/src/api",
  "miniapp/src/api",
  "saas-admin/src/api",
  "website/src/api",
  "platform-miniapp/src/api",
];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

/**
 * [路由文件, 方法, 注册路径, [URL 片段…]]
 *
 * ⚠️ 片段与源码行**都先去掉引号/反引号再比对**（`normalize()`），因此片段要写成
 * `coupons/templates,` 这样的形式（含闭合后的分隔符），以便区分 `.../templates` 与 `.../templates/:id`。
 */
const ENDPOINTS = [
  // ── admin-marketing-calculation.routes.ts（1）──
  ["admin-marketing-calculation.routes.ts", "POST", "/api/admin/marketing/calculate", ["marketing/calculate", "marketing/promotions/calculate"]],
  // ── admin-marketing-coupon.routes.ts（5）──
    ["admin-marketing-coupon.routes.ts", "POST", "/api/admin/marketing/coupons/templates", ["coupons/templates,"]],
    ["admin-marketing-coupon.routes.ts", "PUT", "/api/admin/marketing/coupons/templates/:id", ["coupons/templates/${id},"]],
    ["admin-marketing-coupon.routes.ts", "DELETE", "/api/admin/marketing/coupons/templates/:id", ["coupons/templates/${id},"]],
  ["admin-marketing-coupon.routes.ts", "POST", "/api/admin/marketing/coupons/templates/:id/activate", ["coupons/templates/${id}/activate"]],
  ["admin-marketing-coupon.routes.ts", "POST", "/api/admin/marketing/coupons/templates/:id/pause", ["coupons/templates/${id}/pause"]],
  // ── admin-marketing-full-reduction.routes.ts（5）──
    ["admin-marketing-full-reduction.routes.ts", "POST", "/api/admin/marketing/full-reductions", ["marketing/full-reductions,"]],
    ["admin-marketing-full-reduction.routes.ts", "PUT", "/api/admin/marketing/full-reductions/:id", ["full-reductions/${id},"]],
    ["admin-marketing-full-reduction.routes.ts", "DELETE", "/api/admin/marketing/full-reductions/:id", ["full-reductions/${id},"]],
  ["admin-marketing-full-reduction.routes.ts", "POST", "/api/admin/marketing/full-reductions/:id/activate", ["full-reductions/${id}/activate"]],
  ["admin-marketing-full-reduction.routes.ts", "POST", "/api/admin/marketing/full-reductions/:id/pause", ["full-reductions/${id}/pause"]],
  // ── admin-marketing-group-buy.routes.ts（6）──
    ["admin-marketing-group-buy.routes.ts", "POST", "/api/admin/marketing/group-buys", ["marketing/group-buys,"]],
    ["admin-marketing-group-buy.routes.ts", "PUT", "/api/admin/marketing/group-buys/:id", ["group-buys/${id},"]],
    ["admin-marketing-group-buy.routes.ts", "DELETE", "/api/admin/marketing/group-buys/:id", ["group-buys/${id},"]],
  ["admin-marketing-group-buy.routes.ts", "POST", "/api/admin/marketing/group-buys/:id/activate", ["group-buys/${id}/activate"]],
    ["admin-marketing-group-buy.routes.ts", "POST", "/api/admin/marketing/group-buys/teams", ["group-buys/teams,"]],
  ["admin-marketing-group-buy.routes.ts", "POST", "/api/admin/marketing/group-buys/teams/:teamId/join", ["group-buys/teams/${teamId}/join"]],
  // ── admin-marketing-points.routes.ts（2）──
  ["admin-marketing-points.routes.ts", "PUT", "/api/admin/marketing/points/rule", ["marketing/points/rule"]],
  ["admin-marketing-points.routes.ts", "POST", "/api/admin/marketing/points/redeem", ["marketing/points/redeem"]],
  // ── admin-marketing-stack-rule.routes.ts（3）──
    ["admin-marketing-stack-rule.routes.ts", "POST", "/api/admin/marketing/stack-rules", ["stack-rules,"]],
    ["admin-marketing-stack-rule.routes.ts", "PUT", "/api/admin/marketing/stack-rules/:id", ["stack-rules/${id},"]],
    ["admin-marketing-stack-rule.routes.ts", "DELETE", "/api/admin/marketing/stack-rules/:id", ["stack-rules/${id},"]],
  // ── community-marketing.routes.ts（10）──
  ["community-marketing.routes.ts", "POST", "/api/marketing/group-buy/:id/join", ["group-buy/${teamId}/join", "group-buy/${id}/join"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/group-buy/:id/start", ["group-buy/${activityId}/start", "group-buy/${id}/start"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/group-buy/:id/end", ["group-buy/${id}/end"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/bargain/:id/start", ["bargain/${activityId}/start", "bargain/${id}/start"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/bargain/:id/help", ["bargain/${recordId}/help", "bargain/${id}/help"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/bargain/:id/end", ["bargain/${id}/end"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/seckill/:id/buy", ["seckill/${activityId}/buy", "seckill/${id}/buy"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/seckill/:orderNo/pay", ["seckill/${orderNo}/pay"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/seckill/:orderNo/cancel", ["seckill/${orderNo}/cancel"]],
  ["community-marketing.routes.ts", "POST", "/api/marketing/seckill/:id/end", ["seckill/${id}/end"]],
  // ── marketing-asset.routes.ts（3）──
  ["marketing-asset.routes.ts", "POST", "/api/marketing-asset/", ["marketing-assets,", "marketing-asset,"]],
  ["marketing-asset.routes.ts", "PUT", "/api/marketing-asset/:id", ["marketing-assets/${id},", "marketing-asset/${id},"]],
  ["marketing-asset.routes.ts", "DELETE", "/api/marketing-asset/:id", ["marketing-assets/${id},", "marketing-asset/${id},"]],
  // ── marketing-gift-rule.routes.ts（8）──
  ["marketing-gift-rule.routes.ts", "POST", "/api/admin/marketing/gift-rules/", ["marketing/gift-rules,"]],
  ["marketing-gift-rule.routes.ts", "PUT", "/api/admin/marketing/gift-rules/:id", ["marketing/gift-rules/${id},"]],
  ["marketing-gift-rule.routes.ts", "DELETE", "/api/admin/marketing/gift-rules/:id", ["marketing/gift-rules/${id},"]],
  ["marketing-gift-rule.routes.ts", "POST", "/api/admin/marketing/gift-rules/:id/activate", ["gift-rules/${id}/activate"]],
  ["marketing-gift-rule.routes.ts", "POST", "/api/admin/marketing/gift-rules/:id/pause", ["gift-rules/${id}/pause"]],
  ["marketing-gift-rule.routes.ts", "POST", "/api/admin/marketing/gift-rules/:id/levels", ["gift-rules/${id}/levels"]],
  ["marketing-gift-rule.routes.ts", "PUT", "/api/admin/marketing/gift-rules/:id/levels/:levelId", ["gift-rules/${id}/levels/${levelId}", "levels/${levelId},"]],
  ["marketing-gift-rule.routes.ts", "DELETE", "/api/admin/marketing/gift-rules/:id/levels/:levelId", ["gift-rules/${id}/levels/${levelId}", "levels/${levelId},"]],
  // ── marketing-limited-discount.routes.ts（7）──
  ["marketing-limited-discount.routes.ts", "POST", "/api/admin/marketing/limited-discounts/", ["marketing/limited-discounts,"]],
  ["marketing-limited-discount.routes.ts", "PUT", "/api/admin/marketing/limited-discounts/:id", ["limited-discounts/${id},"]],
  ["marketing-limited-discount.routes.ts", "DELETE", "/api/admin/marketing/limited-discounts/:id", ["limited-discounts/${id},"]],
  ["marketing-limited-discount.routes.ts", "POST", "/api/admin/marketing/limited-discounts/:id/activate", ["limited-discounts/${id}/activate"]],
  ["marketing-limited-discount.routes.ts", "POST", "/api/admin/marketing/limited-discounts/:id/pause", ["limited-discounts/${id}/pause"]],
  ["marketing-limited-discount.routes.ts", "POST", "/api/admin/marketing/limited-discounts/:id/products", ["limited-discounts/${id}/products,"]],
  ["marketing-limited-discount.routes.ts", "DELETE", "/api/admin/marketing/limited-discounts/:id/products/:productId", ["limited-discounts/${id}/products/${productId}", "limited-discounts/${id}/products/${skuId}"]],
  // ── marketing-material.routes.ts（8）──
  ["marketing-material.routes.ts", "POST", "/api/admin/marketing/materials/", ["marketing/materials,"]],
  ["marketing-material.routes.ts", "PUT", "/api/admin/marketing/materials/:id", ["materials/${id},"]],
  ["marketing-material.routes.ts", "DELETE", "/api/admin/marketing/materials/:id", ["materials/${id},"]],
  ["marketing-material.routes.ts", "POST", "/api/admin/marketing/materials/:id/publish", ["materials/${id}/publish"]],
  ["marketing-material.routes.ts", "POST", "/api/admin/marketing/materials/:id/archive", ["materials/${id}/archive"]],
  ["marketing-material.routes.ts", "POST", "/api/admin/marketing/materials/categories", ["materials/categories,"]],
  ["marketing-material.routes.ts", "PUT", "/api/admin/marketing/materials/categories/:id", ["materials/categories/${id},"]],
  ["marketing-material.routes.ts", "DELETE", "/api/admin/marketing/materials/categories/:id", ["materials/categories/${id},"]],
  // ── marketing-points-mall.routes.ts（7）──
  ["marketing-points-mall.routes.ts", "POST", "/api/admin/marketing/points-mall/products", ["marketing/points-mall/products,"]],
  ["marketing-points-mall.routes.ts", "PUT", "/api/admin/marketing/points-mall/products/:id", ["points-mall/products/${id},"]],
  ["marketing-points-mall.routes.ts", "DELETE", "/api/admin/marketing/points-mall/products/:id", ["points-mall/products/${id},"]],
  ["marketing-points-mall.routes.ts", "POST", "/api/admin/marketing/points-mall/products/:id/toggle", ["points-mall/products/${id}/toggle"]],
  ["marketing-points-mall.routes.ts", "POST", "/api/admin/marketing/points-mall/exchange", ["points-mall/exchange"]],
  ["marketing-points-mall.routes.ts", "POST", "/api/admin/marketing/points-mall/exchange-records/:id/cancel", ["exchange-records/${id}/cancel"]],
  ["marketing-points-mall.routes.ts", "POST", "/api/admin/marketing/points-mall/exchange-records/:id/confirm", ["exchange-records/${id}/confirm"]],
  // ── points-mall.routes.ts（6）──
  ["points-mall.routes.ts", "POST", "/api/points-mall/items", ["points-mall/items,"]],
  ["points-mall.routes.ts", "PUT", "/api/points-mall/items/:id", ["points-mall/items/${id},"]],
  ["points-mall.routes.ts", "DELETE", "/api/points-mall/items/:id", ["points-mall/items/${id},"]],
  ["points-mall.routes.ts", "PUT", "/api/points-mall/items/:id/status", ["points-mall/items/${id}/status"]],
  ["points-mall.routes.ts", "PUT", "/api/points-mall/orders/:id/deliver", ["points-mall/orders/${id}/deliver"]],
  ["points-mall.routes.ts", "PUT", "/api/points-mall/orders/:id/cancel", ["points-mall/orders/${id}/cancel"]],
  // ── points.routes.ts（7）──
  ["points.routes.ts", "POST", "/api/admin/members/rules", ["members/rules,"]],
  ["points.routes.ts", "PUT", "/api/admin/members/rules/:id", ["members/rules/${id},"]],
  ["points.routes.ts", "POST", "/api/admin/members/:id/points/adjust", ["points/adjust"]],
  ["points.routes.ts", "POST", "/api/admin/members/levels/config", ["members/levels/config,"]],
  ["points.routes.ts", "PUT", "/api/admin/members/levels/config/:id", ["levels/config/${id},"]],
  ["points.routes.ts", "PUT", "/api/admin/members/levels/config/:id/status", ["levels/config/${id}/status"]],
  ["points.routes.ts", "DELETE", "/api/admin/members/levels/config/:id", ["levels/config/${id},"]],
  // ── retail-announcement.routes.ts（3）──
  ["retail-announcement.routes.ts", "POST", "/api/retail-announcement/admin/retail-announcements", ["retail-announcement/admin/retail-announcements"]],
  ["retail-announcement.routes.ts", "PUT", "/api/retail-announcement/admin/retail-announcements/:id", ["retail-announcement/admin/retail-announcements"]],
  ["retail-announcement.routes.ts", "DELETE", "/api/retail-announcement/admin/retail-announcements/:id", ["retail-announcement/admin/retail-announcements"]],
  // ── retail-announcements-admin.routes.ts（3）──
  ["retail-announcements-admin.routes.ts", "POST", "/api/admin/retail-announcements/", ["admin/retail-announcements,"]],
  ["retail-announcements-admin.routes.ts", "PUT", "/api/admin/retail-announcements/:id", ["admin/retail-announcements/${id},"]],
  ["retail-announcements-admin.routes.ts", "DELETE", "/api/admin/retail-announcements/:id", ["admin/retail-announcements/${id},"]],
  // ── seckill.routes.ts（3）──
  ["seckill.routes.ts", "POST", "/api/seckill/", ["marketing/seckill,"]],
  ["seckill.routes.ts", "PUT", "/api/seckill/:id", ["marketing/seckill/${id},"]],
  ["seckill.routes.ts", "DELETE", "/api/seckill/:id", ["marketing/seckill/${id},"]],
  // ── store-coupon.routes.ts（2）──
  ["store-coupon.routes.ts", "POST", "/api/store/coupons/verify", ["store/coupons/verify,"]],
  ["store-coupon.routes.ts", "POST", "/api/store/coupons/manual-verify", ["store/coupons/manual-verify,"]],
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
  if (existsSync(abs)) ALL.push(...walk(abs));
}
for (const f of ALL) {
  const rel = relative(ROOT, f).split(sep).join("/");
  if (f.endsWith(".vue")) VUES.push(f);
  else if (API_DIRS.some((a) => rel.startsWith(a))) APIS.push(f);
}

const CACHE = new Map();
function linesOf(f) {
  if (!CACHE.has(f)) CACHE.set(f, readFileSync(f, "utf8").split(/\r?\n/));
  return CACHE.get(f);
}
const rel = (f) => relative(ROOT, f).split(sep).join("/");
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
const FN_RE = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/;
const STOP_RE = /^\s*(?:const|let|var|return|if|for|while|switch|throw|await|@|\.|\/\/|\*)/;

function enclosingFn(lines, hitIdx) {
  for (let i = hitIdx; i >= 0 && i > hitIdx - 60; i--) {
    const l = lines[i];
    if (isComment(l)) continue;
    if (STOP_RE.test(l)) continue;
    const m = l.match(FN_RE);
    if (m) return m[1];
  }
  return null;
}

/**
 * 通用函数名黑名单：这类名字（`create` / `update` / `verify` / `toggleStatus` …）在
 * app-mobile 的 `api/request` 辅助层里被大量复用，用它回溯 .vue 会造出**不相干的页面调用点**
 * （首版实测：#2 把 `pages/sales/create-sale.vue:2202` 算成营销券模板的调用者）。
 * ⇒ 这类名字只作为「api 封装函数名」记录，**不参与页面回溯**。
 */
const GENERIC_FN = new Set([
  "create", "update", "delete", "del", "get", "post", "put", "patch", "remove", "save",
  "submit", "toggle", "toggleStatus", "pause", "start", "end", "verify", "close", "add",
  "list", "detail", "fetch", "request", "upload", "confirm", "cancel", "exchange", "join",
  "adjust", "reset", "enable", "disable", "sync", "approve", "reject", "handle",
]);

/**
 * 行内是否出现「方法调用」。
 * ⚠️ 必须同时兼容两种写法：axios 实例 `api.post(`（admin-web/pos.ts）与**裸函数**
 * `post(`（app-mobile 的 `api/request` 导出 post/put/del ⇒ 首版只用 `.post(` 漏掉了整个 app-mobile）。
 * `\b` 保证不误伤 `submitPost(` 这类同后缀标识符。
 */
function hasMethod(line, method) {
  const m = method.toLowerCase();
  const alt = m === "delete" ? "(?:delete|del)" : m;
  const re = new RegExp(`\\b${alt}\\s*\\(`, "i");
  return re.test(line);
}

/** 去引号/反引号后再比对，使片段写法与引号风格无关（`"..."` / `'...'` / `\`...\`` 一视同仁） */
const normalize = (s) => s.replace(/['"`]/g, "");

console.log(`扫描目录：${SCAN_DIRS.join(", ")}`);
console.log(`文件数：${ALL.length}（.vue ${VUES.length} ／ api 模块 ${APIS.length}）`);
console.log("判据：URL 片段命中 且 同一行出现对应 HTTP 方法调用（`.post(`/`.put(`/`.delete(`/`.del(`）；注释行不计。\n");

let idx = 0;
const tally = { page: 0, apiOnly: 0, none: 0 };
for (const [file, method, path, frags] of ENDPOINTS) {
  idx++;
  const pageHits = [];
  const apiHits = [];
  const fns = new Map();
  for (const f of ALL) {
    const isApi = APIS.includes(f);
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (isComment(l)) continue;
      const norm = normalize(l);
      if (!frags.some((fr) => norm.includes(fr))) continue;
      if (!hasMethod(l, method)) continue;
      const loc = `${rel(f)}:${i + 1}`;
      if (isApi) {
        apiHits.push(loc);
        const fn = enclosingFn(lines, i);
        if (fn) {
          if (!fns.has(fn)) fns.set(fn, []);
          fns.get(fn).push(loc);
        }
      } else {
        pageHits.push(loc);
      }
    }
  }
  const viaFn = [];
  const generic = [];
  for (const fn of fns.keys()) {
    if (GENERIC_FN.has(fn)) {
      generic.push(fn);
      continue;
    }
    const re = new RegExp(`\\b${fn}\\s*\\(`);
    for (const v of VUES) {
      const lines = linesOf(v);
      for (let i = 0; i < lines.length; i++) {
        if (isComment(lines[i])) continue;
        if (re.test(lines[i])) viaFn.push(`${rel(v)}:${i + 1} (${fn})`);
      }
    }
  }
  const pages = [...new Set([...pageHits, ...viaFn])];
  let verdict;
  if (pages.length > 0) {
    verdict = "**有页面调用点**";
    tally.page++;
  } else if (apiHits.length > 0) {
    verdict = "仅 api 封装（页面未用）";
    tally.apiOnly++;
  } else {
    verdict = "**全仓无调用点**";
    tally.none++;
  }
  console.log(`## ${idx}. ${method} ${path}  ←  ${file}`);
  console.log(`   api 封装：${apiHits.length ? [...new Set(apiHits)].join(" ; ") : "（无）"}`);
  if (fns.size) console.log(`   封装函数：${[...fns.keys()].join(" / ")}`);
  if (generic.length) console.log(`   ⚠️ 通用名（不参与页面回溯）：${generic.join(" / ")}`);
  console.log(`   页面调用点：${pages.length ? pages.join(" ; ") : "**无**"}`);
  console.log(`   判定：${verdict}`);
  console.log("");
}

console.log(`合计端点：${ENDPOINTS.length}`);
console.log(`判定汇总：有页面调用点 ${tally.page} ／ 仅 api 封装 ${tally.apiOnly} ／ 全仓无调用点 ${tally.none}`);
console.log("\n⚠️ 局限：片段取自前端源码文本；同一行跨路径拼接（URL 与方法分行）会漏，故关键行另由 rg 复核。");
