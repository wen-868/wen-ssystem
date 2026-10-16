#!/usr/bin/env node
/**
 * S3-227 与 main 合并的冲突解法 · 第 2 步：按**门禁实时读数**重算机读台账（凌舟 2026-10-16）
 *
 * 语义（不是"重新生成洗绿"，而是"两侧已裁定移除的并集"）：
 *   - main 侧已移除批 1~8 的条目；本单（S3-227）另把 6 条消费者端（cart）与 3 条查询型 POST 从 gaps 归类出去
 *   - 因此合并态 = authForm==="none" ⇒ gaps；"consumer" ⇒ consumerEnd；"read-only" ⇒ 由脚本 READ_ONLY_POSTS 登记
 *   - `_counts` 全部由实时扫描得出，并由 `rbac-g0-wiring.test.ts` 的"台账一致性 + 自洽"断言兜住
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const P = "backend/scripts/rbac-wiring-baseline.json";
const baseline = JSON.parse(fs.readFileSync(P, "utf8"));
const arr = JSON.parse(execFileSync("node", ["backend/scripts/guard-rbac-wiring.mjs", "--json"], { maxBuffer: 1e8 }).toString());

const byForm = (form) => arr.filter((e) => e.authForm === form);
const group = (list) => {
  const out = {};
  for (const e of [...list].sort((a, b) => a.file.localeCompare(b.file) || `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`))) {
    (out[e.file] ??= []).push(`${e.method} ${e.path}`);
  }
  return out;
};

const gaps = group(byForm("none"));
const consumerEnd = group(byForm("consumer"));
const readOnly = byForm("read-only");
const wired = byForm("inline");

// 源码里 `requirePermission(` 的出现次数（与 rbac-g0-wiring.test.ts 的口径一致）
const routesDir = "backend/src/routes";
let permOccurrences = 0;
for (const f of fs.readdirSync(routesDir).filter((n) => n.endsWith(".routes.ts"))) {
  const src = fs.readFileSync(path.join(routesDir, f), "utf8");
  permOccurrences += (src.match(/requirePermission\(/g) ?? []).length;
}

// notes：以 ours（本单最新说明）为基，补 theirs（main）里本单没有的 key
const ours = JSON.parse(execFileSync("git", ["show", "HEAD:" + P], { maxBuffer: 1e8 }).toString());
const theirs = JSON.parse(execFileSync("git", ["show", "MERGE_HEAD:" + P], { maxBuffer: 1e8 }).toString());
const merged = {};
for (const [k, v] of Object.entries(ours)) if (!["gaps", "consumerEnd", "_counts"].includes(k)) merged[k] = v;
for (const [k, v] of Object.entries(theirs)) if (!(k in merged) && !["gaps", "consumerEnd", "_counts"].includes(k)) merged[k] = v;

merged.gaps = gaps;
merged.consumerEnd = consumerEnd;
merged._counts = {
  files: Object.keys(gaps).length,
  endpoints: Object.values(gaps).reduce((a, b) => a + b.length, 0),
  consumerEndFiles: Object.keys(consumerEnd).length,
  consumerEndEndpoints: Object.values(consumerEnd).reduce((a, b) => a + b.length, 0),
  readOnlyPostFiles: new Set(readOnly.map((e) => e.file)).size,
  readOnlyPostEndpoints: readOnly.length,
  wiredEndpoints: wired.length,
  scannedEndpoints: arr.length,
  wiredPermOccurrences: permOccurrences,
};
merged._s3227_merge = `2026-10-16 merge with main (#350~#352 之后)：gaps 按 authForm=none 重算（${merged._counts.endpoints}/${merged._counts.files}），consumerEnd=${merged._counts.consumerEndEndpoints}，read-only POST=${merged._counts.readOnlyPostEndpoints}，wired=${merged._counts.wiredEndpoints}，wiredPermOccurrences=${permOccurrences}。`;
merged._lastUpdate = "2026-10-16 S3-227 与 main 合并：按门禁实时读数重算机读台账（含 consumerEnd/read-only POST 归类）";

fs.writeFileSync(P, JSON.stringify(merged, null, 2) + "\n");
console.log(JSON.stringify(merged._counts, null, 1));
