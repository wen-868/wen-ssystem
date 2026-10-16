/**
 * S3-233 收尾（2026-10-16，s3240）：把本批落地的**每个权限码**对到"生产在用持有者"，
 * 依据 = 共用底稿 `docs/evidence/_shared/prod-roles-20261016.txt` §一（12 个商家角色 × 权限码）。
 *
 * 用法：node docs/evidence/S3-233/tools/s3240-prod-holders.mjs
 * 判据（派单卡 §二.6 零回归论证）：凡本批用到的码，生产**必须**有在用角色持有；
 *   没有持有者 ⇒ 该条应跳过并登记（"接了但没人能用"）。本脚本只做只读复算，不写任何文件。
 *
 * 通配语义与 `backend/src/services/admin/rbac.service.ts#matchPermission` 同形：
 *   `*`（全通配）／`<域>:*`（域通配）／`*:<动作>`（动作通配）／精确。
 */
import { readFileSync } from "node:fs";

const ROLES_FILE = process.argv[2] ?? "docs/evidence/_shared/prod-roles-20261016.txt";

/** 本批（S3-233）落地用到的码 —— 来自 backend/src/__tests__/routes/rbac-b2-s3-233-gate-wiring-parity.test.ts 的 WIRED_ROWS.perm 去重 */
const CODES = [
  "sale:create",
  "sale:void",
  "inventory:inbound",
  "purchase:create",
  "sale:return",
  "finance:payment",
  "inventory:create",
  "inventory:adjust",
  "store:transfer",
  "goods:edit",
  "goods:price",
  "goods:create",
  "goods:delete",
  "system:user:create",
  "system:user:edit",
  "system:role:create",
  "system:role:edit",
  "marketing:create",
  "finance:create",
  "report:finance",
];

function matchPermission(perms, code) {
  for (const p of perms) {
    if (p === "*") return true;
    if (p === code) return true;
    const [pd, pa] = p.split(":");
    const [cd, ca] = code.split(":");
    if (pa === "*" && pd === cd) return true;
    if (pd === "*" && pa === ca) return true;
  }
  return false;
}

const text = readFileSync(ROLES_FILE, "utf8");
const roles = [];
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\t[^\t]*\t(\[.*\])\s*$/);
  if (!m) continue;
  roles.push({ code: m[1], perms: JSON.parse(m[2]) });
}

console.log(`# 底稿：${ROLES_FILE}`);
console.log(`# 解析到商家角色 ${roles.length} 个：${roles.map((r) => r.code).join(", ")}`);
console.log("");
console.log("| 权限码 | 生产在用持有者（商家角色） | 条数 |");
console.log("|:--|:--|:--:|");
let noHolder = 0;
for (const code of CODES) {
  const holders = roles.filter((r) => matchPermission(r.perms, code)).map((r) => r.code);
  if (holders.length === 0) noHolder++;
  console.log(`| \`${code}\` | ${holders.length ? holders.join(" / ") : "**无**（⇒ 该条应跳过并登记）"} | ${holders.length} |`);
}
console.log("");
console.log(`结论：本批 ${CODES.length} 个码中，**无在用持有者的码 = ${noHolder}**`);
