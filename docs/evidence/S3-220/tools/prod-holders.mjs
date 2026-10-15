#!/usr/bin/env node
/**
 * S3-220 · 由**生产只读导出**复算「某权限码的持有角色」（租户 default）
 *
 * 输入：docs/evidence/S3-220/00-prod-roles-raw.txt（tools/prod-roles-dump.sh 的原始输出）
 * 语义：与 backend/src/services/admin/rbac.service.ts 的 matchPermission 逐行同义
 *       （`*` / `dom:*` / `*:action` / 精确码；SUPER_ADMIN 另在中间件里有短路放行）
 *
 * 为什么不用 `guard-rbac-wiring.mjs --holders`：那个用的是**仓库角色种子**（脚本自述"非生产真值"），
 * 本单要的是**生产真值**（本文件复算的对象就是生产导出）。
 *
 * 用法：node docs/evidence/S3-220/tools/prod-holders.mjs [码1 码2 ...]
 */
import { readFileSync } from "node:fs";

const DUMP = "docs/evidence/S3-220/00-prod-roles-raw.txt";
const TENANT = "default";
const CODES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["goods:create", "goods:edit", "goods:delete", "goods:price", "goods:list"];

function matchPermission(perms, permCode) {
  if (!Array.isArray(perms) || typeof permCode !== "string" || permCode.length === 0) return false;
  if (perms.includes("*")) return true;
  const domIndex = permCode.indexOf(":");
  if (domIndex > 0 && perms.includes(`${permCode.slice(0, domIndex)}:*`)) return true;
  const actionIndex = permCode.lastIndexOf(":");
  if (actionIndex > -1 && actionIndex < permCode.length - 1 && perms.includes(`*:${permCode.slice(actionIndex + 1)}`)) {
    return true;
  }
  return perms.includes(permCode);
}

const text = readFileSync(DUMP, "utf8");
const q1 = text.split("--- Q2")[0];
const roles = [];
for (const line of q1.split(/\r?\n/)) {
  const p = line.split("\t");
  if (p.length < 6) continue;
  const [id, tenant, roleCode, roleName, status, permsJson] = p;
  if (!/^\d+$/.test(id) || tenant !== TENANT) continue;
  let perms;
  try {
    perms = JSON.parse(permsJson);
  } catch {
    continue;
  }
  roles.push({ id, tenant, roleCode, roleName, status, perms });
}

console.log(`数据源：${DUMP}｜租户 \`${TENANT}\`｜角色 ${roles.length} 个（status 全部为 1：${roles.every((r) => r.status === "1")}）`);
console.log(`matchPermission 语义与 \`services/admin/rbac.service.ts\` 同义（* / dom:* / *:action / 精确码）\n`);
for (const code of CODES) {
  const holders = roles.filter((r) => matchPermission(r.perms, code));
  console.log(`\`${code}\` ⇒ ${holders.length} 个角色`);
  for (const h of holders) console.log(`    - ${h.roleCode}（${h.roleName}）  permissions=${JSON.stringify(h.perms)}`);
  const nonHolders = roles.filter((r) => !matchPermission(r.perms, code));
  console.log(`    不持有：${nonHolders.map((r) => r.roleCode).join(" / ") || "（无）"}`);
  console.log("");
}
