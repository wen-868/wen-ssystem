#!/usr/bin/env node
/**
 * S3-212 分歧清单可读化（只读）
 * 用法：node diverge-report.mjs <fk-scan.json> [outFile]
 * 输出：逐组给出 表.列 / 各语料出现处(文件:行) / 类型 / 是否有效定义
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , jsonPath, outFile] = process.argv;
if (!jsonPath) {
  console.error("用法: node diverge-report.mjs <fk-scan.json> [outFile]");
  process.exit(2);
}
const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const short = (p) =>
  p
    .replace(/^docs\/migrations\//, "M/")
    .replace(/^backend\/src\/shared\//, "S/")
    .replace(/^docs\//, "");

const lines = [];
lines.push(`# S3-212 同表多定义 ⇒ 同列异型 分歧清单（组数 = ${data.divergences.length}）`);
lines.push("");
lines.push("| # | 表 | 列 | 变体（类型 ⇒ 出现处） |");
lines.push("|---:|---|---|---|");
data.divergences.forEach((g, i) => {
  const variants = g.variants
    .map((v) => "`" + v.sig + "` ⇒ " + v.where.map(short).join(" , "))
    .join("  ｜ ");
  lines.push(`| ${i + 1} | ${g.table} | ${g.column} | ${variants} |`);
});
lines.push("");
lines.push(`## 涉及分歧的表：有效定义块（按 runner 顺序最靠前的那一块）`);
lines.push("");
const wanted = new Set(data.divergences.map((g) => g.table));
const chosen = new Map();
for (const b of data.blocks ?? []) {
  if (!wanted.has(b.table)) continue;
  const cur = chosen.get(b.table);
  if (!cur || b.order < cur.order) chosen.set(b.table, b);
}
for (const [t, b] of chosen) lines.push(`- ${t} ← ${short(b.file)}:${b.line}（order=${b.order}）`);

const out = lines.join("\n");
if (outFile) writeFileSync(outFile, out, "utf8");
console.log(out);
