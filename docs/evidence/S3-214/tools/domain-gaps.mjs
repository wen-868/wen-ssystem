#!/usr/bin/env node
/**
 * S3-214 阶段① 辅助脚本（只读）：把「台账域划分」与「门禁实测缺口」做域级 join。
 *
 * 输入：
 *   1) docs/tasks/R101-RBAC接线缺口清单.md  —— 域 → 文件 的归属（`### 三.N <域名>（…）` + `**<file>.routes.ts**`）
 *   2) docs/evidence/S3-214/00-baseline-json.txt —— `node backend/scripts/guard-rbac-wiring.mjs --json` 原样输出
 *
 * 输出：每个域的「台账文件数 / 台账端点数 / 实测文件数 / 实测写端点数 / 实测未接线端点数」
 * 用法：node docs/evidence/S3-214/tools/domain-gaps.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
const LEDGER = resolve(ROOT, "docs", "tasks", "R101-RBAC接线缺口清单.md");
const LIVE = resolve(ROOT, "docs", "evidence", "S3-214", "00-baseline-json.txt");

const ledgerText = readFileSync(LEDGER, "utf8");
const liveRaw = readFileSync(LIVE, "utf8");
const live = JSON.parse(liveRaw.slice(liveRaw.indexOf("["), liveRaw.lastIndexOf("]") + 1));

// ---- 1. 台账：域 → 文件 ----
const fileDomain = new Map();
const ledgerDomainFiles = new Map();
const sectionRe = /^### 三\.(\d+)\s+(.+?)（(\d+)\s*文件\s*\/\s*(\d+)\s*端点）/gm;
const sections = [];
let m;
while ((m = sectionRe.exec(ledgerText)) !== null) {
  sections.push({ no: Number(m[1]), name: m[2].trim(), files: Number(m[3]), endpoints: Number(m[4]), start: m.index });
}
for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  const body = ledgerText.slice(s.start, i + 1 < sections.length ? sections[i + 1].start : ledgerText.length);
  const files = [];
  for (const fm of body.matchAll(/^\*\*(.+?\.routes\.ts)\*\*/gm)) {
    files.push(fm[1]);
    if (!fileDomain.has(fm[1])) fileDomain.set(fm[1], s.name);
    else if (fileDomain.get(fm[1]) !== s.name) fileDomain.set(fm[1], fileDomain.get(fm[1]) + " / " + s.name);
  }
  ledgerDomainFiles.set(s.name, { no: s.no, declaredFiles: s.files, declaredEndpoints: s.endpoints, files });
}

// ---- 2. 实测：域 → 端点 ----
const stat = new Map();
function bump(domain, key) {
  if (!stat.has(domain)) stat.set(domain, { files: new Set(), endpoints: 0, gaps: 0, gapFiles: new Set() });
  const s = stat.get(domain);
  s.files.add(key.file);
  s.endpoints++;
  if (!key.hasPermission) { s.gaps++; s.gapFiles.add(key.file); }
}
const unmapped = [];
for (const e of live) {
  const d = fileDomain.get(e.file) ?? "（台账未列 / 新增文件）";
  if (d === "（台账未列 / 新增文件）") unmapped.push(e.file);
  bump(d, e);
}

// ---- 3. 输出 ----
const rows = [...stat.entries()]
  .map(([domain, s]) => ({
    domain,
    no: ledgerDomainFiles.get(domain)?.no ?? 99,
    declaredFiles: ledgerDomainFiles.get(domain)?.declaredFiles ?? "—",
    declaredEndpoints: ledgerDomainFiles.get(domain)?.declaredEndpoints ?? "—",
    liveFiles: s.files.size,
    liveEndpoints: s.endpoints,
    liveGaps: s.gaps,
    liveGapFiles: s.gapFiles.size,
  }))
  .sort((a, b) => b.liveGaps - a.liveGaps);

console.log("域 | 台账文件 | 台账端点 | 实测文件 | 实测写端点 | 实测缺口 | 缺口文件");
console.log(":--|--:|--:|--:|--:|--:|--:");
let totalE = 0, totalG = 0;
for (const r of rows) {
  totalE += r.liveEndpoints; totalG += r.liveGaps;
  console.log(`${r.domain} | ${r.declaredFiles} | ${r.declaredEndpoints} | ${r.liveFiles} | ${r.liveEndpoints} | **${r.liveGaps}** | ${r.liveGapFiles}`);
}
console.log(`合计 | — | — | — | ${totalE} | **${totalG}** | —`);
if (unmapped.length) {
  console.log("\n台账未列文件（" + new Set(unmapped).size + "）：");
  for (const f of new Set(unmapped)) console.log("  " + f);
}
const ledgerFiles = new Set(fileDomain.keys());
const liveFiles = new Set(live.map((e) => e.file));
const onlyLedger = [...ledgerFiles].filter((f) => !liveFiles.has(f));
if (onlyLedger.length) {
  console.log("\n台账列了但当前无写端点（" + onlyLedger.length + "）：");
  for (const f of onlyLedger) console.log("  " + f);
}
