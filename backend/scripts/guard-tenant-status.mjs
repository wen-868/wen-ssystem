#!/usr/bin/env node
/**
 * G2 门禁 · guard:tenant-status（S3-176 B0）
 *
 * 防的是什么（根因）：同一张 `t_tenant` 被两条链路各写一套状态取值
 *   （platform-tenant 写数值 1/0；admin/tenant 原写字符串 'ACTIVE'），
 *   外加 controller 的 Zod 枚举另有一套（ACTIVE/SUSPENDED/EXPIRED/CLOSED），
 *   ⇒ 前端发 DISABLED 被 Zod 400、列表筛选未知值静默返回全量。
 *   只把某一条改对 ⇒ 下一次仍会有第三套出现 ⇒ 反复。
 *   ⇒ 本门禁把「租户状态域只允许 ACTIVE/DISABLED」变成**机械红**。
 *
 * 规则（只作用于"租户状态域"的文件集合，避免误伤其它域的合法枚举）：
 *   R1 域内文件不得出现**带引号**的 SUSPENDED / EXPIRED / CLOSED / PENDING（可写状态值）。
 *      · 列名 `suspended_at`、字段名 `suspendedAt`、注释里的裸词**不算**（必须是引号字面量）。
 *   R2 唯一映射函数 `toTenantStatusValue` 的接受集合必须恰好是 {ACTIVE,1,DISABLED,0}。
 *
 * 用法：node backend/scripts/guard-tenant-status.mjs    退出码 0=绿 / 1=红
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");

/** 租户状态域文件集合（只扫这些，避免误伤工单/订阅等其它域的合法枚举） */
const DOMAIN_FILES = [
  "services/platform-tenant.service.ts",
  "services/admin/tenant.service.ts",
  "controllers/admin/tenant.controller.ts",
  "controllers/platform/tenant.controller.ts",
];

/** 允许出现的例外（必须逐条给理由；键 = 文件相对 SRC 的路径） */
const LITERAL_ALLOWLIST = {
  "controllers/admin/tenant.controller.ts": [
    // 仅为注释中说明"这些不再是可写状态"，非引号字面量，本不会被 R1 命中；
    // 若将来确需保留引号字面量，在此登记理由。
  ],
};

const FORBIDDEN = ["SUSPENDED", "EXPIRED", "CLOSED", "PENDING"];
const problems = [];

for (const rel of DOMAIN_FILES) {
  const abs = join(SRC, rel);
  if (!existsSync(abs)) {
    problems.push(`${rel}: 文件不存在（域清单需同步更新）`);
    continue;
  }
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const word of FORBIDDEN) {
      // 只认带引号的字面量：'ACTIVE' / "ACTIVE"
      const re = new RegExp(`["']${word}["']`);
      if (re.test(line)) {
        const allow = (LITERAL_ALLOWLIST[rel] || []).some((reason) => reason.includes(`${idx + 1}`));
        if (!allow) {
          problems.push(
            `${rel}:${idx + 1}: 出现被禁的租户状态字面量 "${word}" —— 租户状态可写值唯一口径是 ACTIVE / DISABLED（EXPIRED 由 expire_at 派生）`
          );
        }
      }
    }
  });
}

// R2：唯一映射函数的接受集合
const mapper = join(SRC, "services", "platform-tenant.service.ts");
if (existsSync(mapper)) {
  const src = readFileSync(mapper, "utf8");
  const fn = /export function toTenantStatusValue[\s\S]*?\n\}/.exec(src);
  if (!fn) {
    problems.push("services/platform-tenant.service.ts: 找不到 toTenantStatusValue（唯一映射函数）");
  } else {
    const body = fn[0];
    for (const token of ['"ACTIVE"', '"DISABLED"', '"1"', '"0"']) {
      if (!body.includes(token)) {
        problems.push(`toTenantStatusValue 缺少接受的取值 ${token}（唯一口径被改动）`);
      }
    }
    for (const word of FORBIDDEN) {
      if (body.includes(`"${word}"`)) {
        problems.push(`toTenantStatusValue 不应接受 ${word}（可写值只有 ACTIVE/DISABLED）`);
      }
    }
  }
}

console.log(`[guard:tenant-status] 扫描 ${DOMAIN_FILES.length} 个域内文件 + 唯一映射函数`);
if (problems.length > 0) {
  console.error(`\n❌ G2 违规 ${problems.length} 条：`);
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}
console.log("✅ G2 通过：租户状态域只有 ACTIVE / DISABLED 一套口径");
