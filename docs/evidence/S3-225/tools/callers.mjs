#!/usr/bin/env node
/**
 * S3-225 · 员工/账号域 31 条写端点「前端调用面」清点（只读）
 *
 * 目的：为每一条端点给出「谁在用」的**可复跑证据**（文件:行），
 *      并把调用点分成三类，供「零回归」判定使用：
 *        ① page   = .vue 页面里的真实调用（有页面 ⇒ 需要核对该页的角色门）
 *        ② api    = 前端 api 模块里的封装（可能没有任何页面使用）
 *        ③ other  = 其它（含 .ts 逻辑层）
 *
 * 用法：node docs/evidence/S3-225/tools/callers.mjs
 * 输出：markdown 表格到 stdout（落盘见 02-callers.txt）
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["admin-web/src", "app-mobile/src", "miniapp/src", "saas-admin/src"];
const SKIP = new Set(["node_modules", "dist", ".git", "unpackage"]);

const ENDPOINTS = [
  ["admin-auth.routes.ts", "PUT", "/api/admin/auth/settings", ["admin/auth/settings"]],
  ["admin-auth.routes.ts", "POST", "/api/admin/auth/change-password", ["admin/auth/change-password"]],
  ["admin-auth.routes.ts", "POST", "/api/admin/auth/mfa/setup", ["mfa/setup"]],
  ["admin-auth.routes.ts", "POST", "/api/admin/auth/mfa/confirm", ["mfa/confirm"]],
  ["admin-auth.routes.ts", "POST", "/api/admin/auth/mfa/disable", ["mfa/disable"]],
  ["admin-staff.routes.ts", "POST", "/api/admin/staff", ["post(\"/admin/staff\"", "post('/admin/staff'", "post(`/admin/staff`"]],
  ["admin-staff.routes.ts", "PUT", "/api/admin/staff/:id", ["`/admin/staff/${", "'/admin/staff/' +", "\"/admin/staff/\" +"]],
  ["admin-staff.routes.ts", "PUT", "/api/admin/staff/:id/status", ["/status`", "/status'", "/status\""]],
  ["admin-staff.routes.ts", "PUT", "/api/admin/staff/:id/disable", ["/disable`", "/disable'", "/disable\""]],
  ["admin-staff.routes.ts", "POST", "/api/admin/staff/:id/restore", ["/restore`", "/restore'", "/restore\""]],
  ["data-permission.routes.ts", "POST", "/api/admin/data-permissions/", ["post('/admin/data-permissions'", "post(\"/admin/data-permissions\"", "post(`/admin/data-permissions`"]],
  ["data-permission.routes.ts", "PUT", "/api/admin/data-permissions/:id", ["`/admin/data-permissions/${", "'/admin/data-permissions/'"]],
  ["data-permission.routes.ts", "DELETE", "/api/admin/data-permissions/:id", ["`/admin/data-permissions/${", "'/admin/data-permissions/'"]],
  ["data-permission.routes.ts", "POST", "/api/admin/data-permissions/roles/:roleId", ["data-permissions/roles/"]],
  ["data-permission.routes.ts", "DELETE", "/api/admin/data-permissions/roles/:roleId/:dataPermissionId", ["data-permissions/roles/"]],
  ["data-permission.routes.ts", "POST", "/api/admin/data-permissions/users/:userId/check", ["data-permissions/users/"]],
  ["department.routes.ts", "POST", "/api/department/", ["post('/department'", "post(\"/department\"", "post(`/department`"]],
  ["department.routes.ts", "PUT", "/api/department/:id", ["`/department/${", "'/department/'"]],
  ["department.routes.ts", "DELETE", "/api/department/:id", ["`/department/${", "'/department/'"]],
  ["department.routes.ts", "PUT", "/api/department/:id/move", ["/move`", "/move'"]],
  ["rbac.routes.ts", "POST", "/api/admin/system/roles/", ["post('/admin/system/roles'", "post(\"/admin/system/roles\"", "post(`/admin/system/roles`"]],
  ["rbac.routes.ts", "PUT", "/api/admin/system/roles/:id", ["`/admin/system/roles/${", "'/admin/system/roles/'"]],
  ["rbac.routes.ts", "DELETE", "/api/admin/system/roles/:id", ["`/admin/system/roles/${", "'/admin/system/roles/'"]],
  ["rbac.routes.ts", "PUT", "/api/admin/system/roles/:id/data-permissions", ["data-permissions"]],
  ["rbac.routes.ts", "PUT", "/api/admin/system/roles/users/:userId/roles", ["/roles/", "roles/users"]],
  ["sys-user.routes.ts", "POST", "/api/admin/sys-users/", ["post('/admin/sys-users'", "post(\"/admin/sys-users\"", "post(`/admin/sys-users`"]],
  ["sys-user.routes.ts", "PUT", "/api/admin/sys-users/:id", ["`/admin/sys-users/${", "'/admin/sys-users/'"]],
  ["sys-user.routes.ts", "POST", "/api/admin/sys-users/:id/reset-password", ["reset-password"]],
  ["sys-user.routes.ts", "DELETE", "/api/admin/sys-users/:id", ["`/admin/sys-users/${", "'/admin/sys-users/'", "del(`/admin/sys-users"]],
  ["user-session.routes.ts", "DELETE", "/api/user-session/:id", ["user-session/"]],
  ["user-session.routes.ts", "DELETE", "/api/user-session/user/:userId", ["user-session/user"]],
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
console.log("| # | 端点 | 页面调用点（.vue） | api / 其它调用点 | 判定 |");
console.log("|--:|:--|:--|:--|:--|");

let n = 0;
for (const [, method, path, patterns] of ENDPOINTS) {
  n++;
  const pageHits = [];
  const apiHits = [];
  for (const f of FILES) {
    const lines = linesOf(f);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!patterns.some((p) => l.includes(p))) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
      const s = `${rel(f)}:${i + 1}`;
      (isVue(f) ? pageHits : apiHits).push(s);
    }
  }
  const verdict =
    pageHits.length > 0 ? "**有页面调用点**" : apiHits.length > 0 ? "仅 api 封装（页面未用）" : "**全仓无调用点**";
  console.log(
    `| ${n} | \`${method} ${path}\` | ${pageHits.length ? pageHits.join("<br>") : "—"} | ${apiHits.length ? apiHits.join("<br>") : "—"} | ${verdict} |`
  );
}
console.log(`\n合计端点：${ENDPOINTS.length}`);
