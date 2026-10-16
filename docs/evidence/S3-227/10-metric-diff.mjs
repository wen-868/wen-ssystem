#!/usr/bin/env node
/**
 * S3-227 证据脚本（只读分析，非交付物）：
 * 解释「两个『已接线数』口径为什么不是同一个数」——
 *   ① 用例口径 = `rbac-g0-wiring.test.ts` 的和式右端 = routes/*.routes.ts 里 `requirePermission(` 的出现次数；
 *   ② 门禁口径 = `guard-rbac-wiring.mjs` 报告的「已接线（权限码）N 处」= authForm ∈ {inline, use-mount} 的**写端点**数。
 * 逐文件比出差异，并把差异归因到三类（use 挂载一次覆盖多端点 / 非写端点上的 occurrence / 平台机制端点）。
 *
 * 用法：node docs/evidence/S3-227/10-metric-diff.mjs [--json <guard --json 输出文件>]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ROUTES_DIR = join(REPO, "backend", "src", "routes");
const jsonArgIdx = process.argv.indexOf("--json");
const jsonPath = jsonArgIdx > -1 ? process.argv[jsonArgIdx + 1] : join(HERE, "00-before", "guard-json.json");

const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
const guardWiredPerFile = new Map();
for (const r of rows) {
  if (r.authForm !== "inline" && r.authForm !== "use-mount") continue;
  guardWiredPerFile.set(r.file, (guardWiredPerFile.get(r.file) ?? 0) + 1);
}

const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts")).sort();
const detail = [];
let occTotal = 0;
let guardTotal = 0;
for (const f of files) {
  const src = readFileSync(join(ROUTES_DIR, f), "utf8");
  const occ = (src.match(/requirePermission\(/g) ?? []).length;
  const wired = guardWiredPerFile.get(f) ?? 0;
  occTotal += occ;
  guardTotal += wired;
  if (occ !== wired) detail.push({ file: f, occ, wired, delta: wired - occ });
}

console.log(`[口径对照] 用例口径（requirePermission( 出现次数）= ${occTotal}`);
console.log(`[口径对照] 门禁口径（authForm ∈ inline/use-mount 的写端点数）= ${guardTotal}`);
console.log(`[口径对照] 差值 = ${guardTotal - occTotal}（逐文件差异见下，仅列不等的文件）`);
console.log("");
console.log("file".padEnd(46) + "occ".padStart(5) + "wired".padStart(7) + "delta".padStart(7));
for (const d of detail) {
  console.log(d.file.padEnd(46) + String(d.occ).padStart(5) + String(d.wired).padStart(7) + String(d.delta).padStart(7));
}
console.log("");
console.log(`[平台机制] 平台侧 requirePlatformPermission 端点（门禁算已接线、用例口径不计）：`);
for (const [f, n] of guardWiredPerFile) {
  const src = readFileSync(join(ROUTES_DIR, f), "utf8");
  const plat = (src.match(/requirePlatformPermission\(/g) ?? []).length;
  if (plat > 0) console.log(`   ${f}: requirePlatformPermission 出现 ${plat} 次`);
}
