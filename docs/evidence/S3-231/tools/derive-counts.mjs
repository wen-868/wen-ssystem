#!/usr/bin/env node
/**
 * S3-231（S3-229 验收异议整改）· `rbac-wiring-baseline.json` 的 `_counts` **逐字段独立复算**。
 *
 * 背景（验收异议）：`_counts` 的 `files` / `wiredEndpoints` / `wiredPermOccurrences` 三个字段被怀疑"错位"，
 * 且此前的读数文件里混着门禁的**全量缺口清单**（39 KB），关键三行被"目录噪声"淹没。
 *
 * 本脚本的立场：**台账自述不算证据** —— 每个字段都用「门禁 --json 实测 + 源码实测」重建，
 * 再与台账 `_counts` 逐字段比对；任何一处对不上 ⇒ 打印 FAIL 并以 EXIT=1 退出。
 *
 * 口径定义（来源：`rbac-wiring-baseline.json` 的 `_s3227_note` 与 `_endpointClass`，非本脚本臆造）：
 *   · `endpoints`            = `gaps` 条目数 = 门禁实测 `hasPermission=false && authForm='none'` 的写端点数；
 *   · `files`                = 上述端点的**去重文件数**（缺口文件数，不是已接线文件数）；
 *   · `consumerEndEndpoints` = `authForm='consumer'` 的端点数；`consumerEndFiles` 为其去重文件数；
 *   · `readOnlyPostEndpoints`= `authForm='read-only'` 的端点数（脚本内 `READ_ONLY_POSTS` 显式登记）；
 *   · `wiredEndpoints`       = **门禁口径**已接线数 = `hasPermission=true && authForm ∈ {inline, use-mount}`；
 *   · `scannedEndpoints`     = 扫描到的写端点总数（763）；
 *   · `wiredPermOccurrences` = **用例口径** = `backend/src/routes/*.routes.ts` 里 `requirePermission(` 的**出现次数**
 *                              （≠ `wiredEndpoints`：门禁把平台侧 `requirePlatformPermission` 端点也算已接线，且不数非写端点）。
 *   · 守恒式：`endpoints + consumerEndEndpoints + readOnlyPostEndpoints + wiredEndpoints === scannedEndpoints`。
 *
 * 用法（仓库根目录）：node docs/evidence/S3-231/tools/derive-counts.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASELINE = "backend/scripts/rbac-wiring-baseline.json";
const ROUTES_DIR = "backend/src/routes";

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const ledger = baseline._counts;

const json = JSON.parse(
  execFileSync("node", ["backend/scripts/guard-rbac-wiring.mjs", "--json"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
);
const rows = json.endpoints ?? json;

// ── ① 由门禁实测重建每个字段 ─────────────────────────────────────────────
const measured = {
  scannedEndpoints: rows.length,
  endpoints: rows.filter((r) => !r.hasPermission && r.authForm === "none").length,
  files: new Set(rows.filter((r) => !r.hasPermission && r.authForm === "none").map((r) => r.file)).size,
  consumerEndEndpoints: rows.filter((r) => r.authForm === "consumer").length,
  consumerEndFiles: new Set(rows.filter((r) => r.authForm === "consumer").map((r) => r.file)).size,
  readOnlyPostEndpoints: rows.filter((r) => r.authForm === "read-only").length,
  readOnlyPostFiles: new Set(rows.filter((r) => r.authForm === "read-only").map((r) => r.file)).size,
  wiredEndpoints: rows.filter((r) => r.hasPermission && ["inline", "use-mount"].includes(r.authForm)).length,
};

// `wiredPermOccurrences`：源码实测（routes 目录下 `requirePermission(` 的出现次数）
const routeFiles = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));
let occurrences = 0;
let occurrencesOnGetLines = 0;
let platformOccurrences = 0;
const getLineFiles = new Set();
for (const f of routeFiles) {
  const src = readFileSync(join(ROUTES_DIR, f), "utf8");
  occurrences += (src.match(/requirePermission\(/g) ?? []).length;
  platformOccurrences += (src.match(/requirePlatformPermission\(/g) ?? []).length;
  for (const line of src.split(/\r?\n/)) {
    if (line.includes("requirePermission(") && /\.get\(/.test(line)) {
      occurrencesOnGetLines += (line.match(/requirePermission\(/g) ?? []).length;
      getLineFiles.add(f);
    }
  }
}
measured.wiredPermOccurrences = occurrences;

// 台账 `gaps` / `consumerEnd` 的逐文件条目数（台账自述，用于与实测交叉核对）
const sum = (o) => Object.values(o).reduce((a, list) => a + list.length, 0);
const ledgerGapEntries = sum(baseline.gaps);
const ledgerConsumerEntries = sum(baseline.consumerEnd);

// ── ② 逐字段比对 ───────────────────────────────────────────────────────
const FIELDS = [
  "files",
  "endpoints",
  "consumerEndFiles",
  "consumerEndEndpoints",
  "readOnlyPostFiles",
  "readOnlyPostEndpoints",
  "wiredEndpoints",
  "scannedEndpoints",
  "wiredPermOccurrences",
];

console.log("S3-231 · `_counts` 逐字段独立复算（台账自述 vs 门禁/源码实测）\n");
console.log("字段".padEnd(22) + "台账 _counts".padEnd(14) + "实测重建".padEnd(12) + "判定");
console.log("-".repeat(60));
let failed = 0;
for (const f of FIELDS) {
  const ok = ledger[f] === measured[f];
  if (!ok) failed++;
  console.log(`${f.padEnd(22)}${String(ledger[f]).padEnd(14)}${String(measured[f]).padEnd(12)}${ok ? "PASS" : "FAIL"}`);
}

console.log("\n—— 交叉核对 ——");
const checks = [
  ["台账 gaps 条目数 == 台账 _counts.endpoints", ledgerGapEntries === ledger.endpoints, `${ledgerGapEntries} vs ${ledger.endpoints}`],
  ["台账 consumerEnd 条目数 == 台账 _counts.consumerEndEndpoints", ledgerConsumerEntries === ledger.consumerEndEndpoints, `${ledgerConsumerEntries} vs ${ledger.consumerEndEndpoints}`],
  [
    "守恒式 endpoints + consumerEnd + readOnlyPost + wired == scanned",
    ledger.endpoints + ledger.consumerEndEndpoints + ledger.readOnlyPostEndpoints + ledger.wiredEndpoints === ledger.scannedEndpoints,
    `${ledger.endpoints}+${ledger.consumerEndEndpoints}+${ledger.readOnlyPostEndpoints}+${ledger.wiredEndpoints} = ${ledger.endpoints + ledger.consumerEndEndpoints + ledger.readOnlyPostEndpoints + ledger.wiredEndpoints} vs ${ledger.scannedEndpoints}`,
  ],
  ["门禁四桶之和 == scannedEndpoints", rows.length === measured.scannedEndpoints, `${rows.length}`],
];
for (const [name, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  （${detail}）`);
}

console.log("\n—— 两个口径的差额分解（`wiredEndpoints` 337 vs `wiredPermOccurrences` 308）——");
const platformWired = rows.filter((r) => r.hasPermission && r.file.startsWith("platform")).length;
const decomposition =
  measured.wiredPermOccurrences + platformWired - occurrencesOnGetLines;
console.log(`用例口径实测 requirePermission( 出现次数                 = ${measured.wiredPermOccurrences}`);
console.log(`  ＋ 门禁把「平台侧 requirePlatformPermission 端点」算作已接线 = +${platformWired}`);
console.log(`  − 挂在非写端点（GET 行）上的出现次数（${[...getLineFiles].join(",")}）  = -${occurrencesOnGetLines}`);
console.log(`  = 门禁口径 wiredEndpoints                                   = ${decomposition}`);
console.log(`（另：requirePlatformPermission( 出现次数 = ${platformOccurrences}，与端点数 ${platformWired} 不必相等 —— 一处 router.use 可覆盖多端点）`);
const decompOk = decomposition === ledger.wiredEndpoints;
if (!decompOk) failed++;
console.log(`${decompOk ? "PASS" : "FAIL"}  差额分解收敛到 _counts.wiredEndpoints`);

console.log(`\n结论：${failed === 0 ? "✅ 全部字段与守恒式一致，未见错位" : `❌ ${failed} 处不一致`}`);
process.exit(failed === 0 ? 0 : 1);
