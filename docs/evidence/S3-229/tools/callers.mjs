#!/usr/bin/env node
/**
 * S3-229 · 门店/租户域（8 文件 / 31 写端点缺口）+ 营销域 W 类（2 文件 / 14 写端点）「前端调用面」清点（只读）。
 *
 * 目的：为每条端点给出「谁在用」的可复跑证据（`文件:行` + 同行的 HTTP 方法调用），
 *      供「使用者集合是否可枚举 / 页面在用可见角色 ⊆ 权限码持有人」判定使用（派单卡 §三.2）。
 *
 * 口径：
 *   · 在 6 个前端 `src` 下搜「URL 片段命中 **且** 同一行出现对应 HTTP 方法调用」（`.post(` / `post(` / `.put(` / …）；
 *   · 去引号后比对（`normalize()`）⇒ `"…"` / `'…'` / `` `…` `` 一视同仁；
 *   · 注释行不计（`//` / `*` 开头）；
 *   · 命中行即列出（含 api 封装与 .vue 页面两种，由路径是否在 `api/` 下区分）。
 *
 * 用法：node docs/evidence/S3-229/tools/callers.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["admin-web/src", "app-mobile/src", "miniapp/src", "saas-admin/src", "website/src", "platform-miniapp/src"];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

/**
 * [路由文件, 方法, 注册路径, [URL 片段…]] —— 片段取自前端源码里真实出现的文本。
 *
 * ⚠️ 片段是 **AND** 语义（同一行必须**全部**命中）：单个泛化片段（如 `/cancel`、`/pay`、`/status`）
 * 会命中大量无关文件（S3-226 首版 `||` 语义的教训），故每条都写"路径段 + 动作段"两截。
 */
const ENDPOINTS = [
  // ── G1 管理面（17）──
  ["admin-store.routes.ts", "post", "/api/admin/system/stores", ["admin/system/stores"]],
  ["admin-store.routes.ts", "put", "/api/admin/system/stores/:id", ["admin/system/stores"]],
  ["demo.routes.ts", "post", "/api/admin/demo/seed", ["admin/demo/seed"]],
  ["demo.routes.ts", "post", "/api/admin/demo/reset", ["admin/demo/reset"]],
  ["store-control.routes.ts", "put", "/api/admin/store-control/configs/:storeId", ["store-control/configs/${"]],
  ["store-control.routes.ts", "post", "/api/admin/store-control/:storeId/open", ["store-control/${storeId}/open"]],
  ["store-control.routes.ts", "post", "/api/admin/store-control/:storeId/close", ["store-control/${storeId}/close"]],
  ["store-control.routes.ts", "post", "/api/admin/store-control/:storeId/suspend", ["store-control/${storeId}/suspend"]],
  ["store-control.routes.ts", "post", "/api/admin/store-control/:storeId/resume", ["store-control/${storeId}/resume"]],
  ["store-value-card.routes.ts", "post", "/api/admin/store-value-cards/", ["admin/store-value-cards"]],
  ["store-value-card.routes.ts", "post", "/api/admin/store-value-cards/:cardNo/recharge", ["store-value-cards/", "/recharge"]],
  ["store-value-card.routes.ts", "post", "/api/admin/store-value-cards/:cardNo/freeze", ["store-value-cards/", "/freeze"]],
  ["store-value-card.routes.ts", "post", "/api/admin/store-value-cards/:cardNo/unfreeze", ["store-value-cards/", "/unfreeze"]],
  ["store.routes.ts", "post", "/api/store/members/manage", ["store/members/manage"]],
  ["store.routes.ts", "put", "/api/store/members/:id", ["store/members/"]],
  ["tenant-register.routes.ts", "post", "/api/tenant/applications/:id/approve", ["applications/${id}/approve"]],
  ["tenant-register.routes.ts", "post", "/api/tenant/applications/:id/reject", ["applications/${id}/reject"]],
  // ── G1 公开端点（2）──
  ["tenant-register.routes.ts", "post", "/api/tenant/register", ["tenant/register"]],
  ["tenant-register.routes.ts", "post", "/api/tenant/register/sms-code", ["tenant/register/sms-code"]],
  // ── G1 平台域（12，卡片明示不在本单）──
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/plans", ["subscriptions-management"]],
  ["subscription.routes.ts", "put", "/api/platform/subscriptions-management/plans/:planId", ["subscriptions-management"]],
  ["subscription.routes.ts", "put", "/api/platform/subscriptions-management/plans/:planId/policy", ["subscriptions-management"]],
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/", ["subscriptions-management"]],
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/:subscriptionId/change-plan", ["subscriptions-management"]],
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/:subscriptionId/cancel", ["subscriptions-management"]],
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/:subscriptionId/pay", ["subscriptions-management"]],
  ["subscription.routes.ts", "post", "/api/platform/subscriptions-management/:subscriptionId/renew", ["subscriptions-management"]],
  ["tenant.routes.ts", "post", "/api/platform/tenants-management/", ["tenants-management"]],
  ["tenant.routes.ts", "put", "/api/platform/tenants-management/:tenantId", ["tenants-management"]],
  ["tenant.routes.ts", "put", "/api/platform/tenants-management/:tenantId/status", ["tenants-management"]],
  ["tenant.routes.ts", "put", "/api/platform/tenants-management/:tenantId/modules", ["tenants-management"]],
  // ── G2 营销域 W 类（14）──
  ["community-marketing.routes.ts", "post", "/api/marketing/group-buy/:id/join", ["group-buy/", "/join"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/group-buy/:id/start", ["group-buy/", "/start"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/group-buy/:id/end", ["group-buy/", "/end"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/bargain/:id/start", ["bargain/", "/start"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/bargain/:id/help", ["bargain/", "/help"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/bargain/:id/end", ["bargain/", "/end"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/seckill/:id/buy", ["seckill/", "/buy"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/seckill/:orderNo/pay", ["seckill/", "/pay"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/seckill/:orderNo/cancel", ["seckill/", "/cancel"]],
  ["community-marketing.routes.ts", "post", "/api/marketing/seckill/:id/end", ["seckill/", "/end"]],
  ["points.routes.ts", "post", "/api/admin/members/levels/config", ["members/levels/config"]],
  ["points.routes.ts", "put", "/api/admin/members/levels/config/:id", ["levels/config/"]],
  ["points.routes.ts", "put", "/api/admin/members/levels/config/:id/status", ["levels/config/", "/status"]],
  ["points.routes.ts", "delete", "/api/admin/members/levels/config/:id", ["levels/config/"]],
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
    else if (/\.(ts|vue|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const ALL = [];
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  if (existsSync(abs)) ALL.push(...walk(abs));
}
const CACHE = new Map();
const linesOf = (f) => {
  if (!CACHE.has(f)) CACHE.set(f, readFileSync(f, "utf8").split(/\r?\n/));
  return CACHE.get(f);
};
const rel = (f) => relative(ROOT, f).split(sep).join("/");
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
const normalize = (s) => s.replace(/['"`]/g, "");
const hasMethod = (line, method) => {
  const m = method.toLowerCase();
  const alt = m === "delete" ? "(?:delete|del)" : m;
  return new RegExp(`\\b${alt}\\s*\\(`, "i").test(line);
};

console.log(`扫描目录：${SCAN_DIRS.join(", ")}（文件数 ${ALL.length}）`);
console.log("判据：URL 片段命中 **且** 同一行出现对应 HTTP 方法调用；注释行不计。\n");

let idx = 0;
for (const [file, method, path, frags] of ENDPOINTS) {
  idx++;
  const hits = [];
  for (const f of ALL) {
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (isComment(l)) continue;
      const norm = normalize(l);
      if (!frags.every((fr) => norm.includes(fr))) continue;
      if (!hasMethod(l, method)) continue;
      hits.push(`${rel(f)}:${i + 1}`);
    }
  }
  console.log(`## ${idx}. ${method.toUpperCase()} ${path}  ←  ${file}`);
  console.log(`   调用点：${hits.length ? [...new Set(hits)].join(" ; ") : "**全仓无有效调用点（方法+路径同行的命中为零）**"}`);
  console.log("");
}
console.log("⚠️ 局限：片段取自前端源码文本；跨行拼接（URL 与方法分行）会漏，关键行另由 rg 复核（见 01-plan-and-judgements.md）。");
