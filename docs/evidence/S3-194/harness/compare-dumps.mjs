#!/usr/bin/env node
/**
 * S3-194 结构快照对比装置（只读）
 * 用法：node compare-dumps.mjs <dirA（左）> <dirB（右）> <输出 md 路径> <标题>
 *
 * 对比口径：
 *   tables.tsv  ：表名集合 + ENGINE + TABLE_COLLATION
 *   columns.tsv ：(表.列) → 类型 / 可空 / 默认值 / 字符集 / 排序规则 / EXTRA
 *   indexes.tsv ：(表.索引) → 唯一性 + 列序列
 *   fks.tsv     ：(表.约束) → 两侧列 + 更新/删除规则
 *
 * 分类（每类给出条数与样例，C 类全量列出）：
 *   A 整数显示宽度（MySQL 8.0.19+ 已移除 int(11)/bigint(20)/tinyint(4) 显示宽度）→ 引擎天然差异
 *   B 排序规则 0900_ai_ci ↔ general_ci → 引擎天然差异
 *   C 表/列/索引/外键"存在性"差异 → 真实结构差异，需逐条解释
 *   D 其余字段差异 → 需人工核对
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dirA, dirB, outPath, title] = process.argv.slice(2);
const read = (d, f) => readFileSync(join(d, f), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
const rows = (d, f) => read(d, f).map((l) => l.split("\t"));

const normType = (t) =>
  t.toLowerCase()
    .replace(/\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)/g, "$1")
    .replace(/int\(\d+\)/g, "int");
const normColl = (c) => c.replace(/utf8mb4_0900_ai_ci/g, "utf8mb4_X_ai_ci").replace(/utf8mb4_general_ci/g, "utf8mb4_X_ci");

const K = ["A_intWidth", "B_collation", "N3_nullRepr", "N4_tsRepr", "N5_quoteDefault", "N6_jsonAlias", "N7_fkRule", "C_existence", "D_other"];
const cls = Object.fromEntries(K.map((k) => [k, []]));
const push = (k, s) => cls[k].push(s);

/** 引擎天然差异归一（MySQL 8.0.46 ↔ MariaDB 11.4.5 的实例级显示差异） */
const normDefault = (v) => {
  // `<NULL>`(本装置的占位) ↔ `NULL`（MariaDB 客户端显示）
  let s = v === "<NULL>" ? "NULL" : v;
  s = s.replace(/^current_timestamp\(\)$/i, "CURRENT_TIMESTAMP");
  s = s.replace(/^'(.*)'$/s, "$1"); // 'X' → X（默认值引号差异）
  return s;
};
const normExtra = (v) =>
  (v || "")
    .replace(/DEFAULT_GENERATED/gi, "")
    .replace(/on update current_timestamp\(\)/gi, "on update CURRENT_TIMESTAMP")
    .replace(/\s+/g, " ")
    .trim();
const normTypeX = (t) => (t.toLowerCase() === "longtext" || t.toLowerCase() === "json" ? "JSON|LONGTEXT" : t.toLowerCase());
const normFkRule = (r) => (r === "RESTRICT" ? "NO ACTION" : r);

// ---------- tables ----------
const tA = new Map(rows(dirA, "tables.tsv").map((r) => [r[0], r]));
const tB = new Map(rows(dirB, "tables.tsv").map((r) => [r[0], r]));
for (const k of new Set([...tA.keys(), ...tB.keys()])) {
  if (!tA.has(k)) { push("C_existence", `表仅存在于右：${k}`); continue; }
  if (!tB.has(k)) { push("C_existence", `表仅存在于左：${k}`); continue; }
  if (tA.get(k)[1] !== tB.get(k)[1]) push("C_existence", `表 ${k} 引擎不同：${tA.get(k)[1]} vs ${tB.get(k)[1]}`);
  const ca = normColl(tA.get(k)[2]); const cb = normColl(tB.get(k)[2]);
  if (ca !== cb) push("B_collation", `表 ${k} 排序规则：${tA.get(k)[2]} vs ${tB.get(k)[2]}`);
  if ((tA.get(k)[3] ?? "") !== (tB.get(k)[3] ?? "")) push("D_other", `表 ${k} 注释：${tA.get(k)[3]} vs ${tB.get(k)[3]}`);
}

// ---------- columns ----------
const cA = new Map(rows(dirA, "columns.tsv").map((r) => [`${r[0]}.${r[2]}`, r]));
const cB = new Map(rows(dirB, "columns.tsv").map((r) => [`${r[0]}.${r[2]}`, r]));
for (const k of new Set([...cA.keys(), ...cB.keys()])) {
  if (!cA.has(k)) { push("C_existence", `列仅存在于右：${k}（${cB.get(k)[3]}）`); continue; }
  if (!cB.has(k)) { push("C_existence", `列仅存在于左：${k}（${cA.get(k)[3]}）`); continue; }
  const a = cA.get(k); const b = cB.get(k);
  const ta = normTypeX(normType(a[3])); const tb = normTypeX(normType(b[3]));
  if (ta !== tb) push("D_other", `列 ${k} 类型：${a[3]} vs ${b[3]}`);
  else if (a[3] !== b[3]) {
    if (normTypeX(a[3]) === "JSON|LONGTEXT") push("N6_jsonAlias", `列 ${k} JSON ↔ LONGTEXT：${a[3]} vs ${b[3]}`);
    else push("A_intWidth", `列 ${k} 仅整数显示宽度不同：${a[3]} vs ${b[3]}`);
  }
  if (a[4] !== b[4]) push("D_other", `列 ${k} 可空性：${a[4]} vs ${b[4]}`);
  if (normDefault(a[5]) !== normDefault(b[5])) push("D_other", `列 ${k} 默认值：${a[5]} vs ${b[5]}`);
  else if (a[5] !== b[5]) {
    if (a[5] === "<NULL>" || b[5] === "<NULL>") push("N3_nullRepr", `列 ${k} NULL 显示差异：${a[5]} vs ${b[5]}`);
    else if (/current_timestamp/i.test(a[5]) || /current_timestamp/i.test(b[5])) push("N4_tsRepr", `列 ${k} 时间戳默认值显示差异：${a[5]} vs ${b[5]}`);
    else push("N5_quoteDefault", `列 ${k} 默认值引号差异：${a[5]} vs ${b[5]}`);
  }
  if (a[6] !== b[6]) {
    if (normTypeX(a[3]) === "JSON|LONGTEXT") push("N6_jsonAlias", `列 ${k} 字符集差异（JSON↔LONGTEXT 连带）：${a[6]} vs ${b[6]}`);
    else push("D_other", `列 ${k} 字符集：${a[6]} vs ${b[6]}`);
  }
  if (normColl(a[7]) !== normColl(b[7])) push("B_collation", `列 ${k} 排序规则：${a[7]} vs ${b[7]}`);
  if (normExtra(a[8]) !== normExtra(b[8])) push("D_other", `列 ${k} EXTRA：${a[8]} vs ${b[8]}`);
  else if (a[8] !== b[8]) push("N4_tsRepr", `列 ${k} EXTRA 显示差异：${a[8]} vs ${b[8]}`);
  if ((a[9] ?? "") !== (b[9] ?? "")) push("D_other", `列 ${k} 注释：${a[9]} vs ${b[9]}`);
}

// ---------- indexes ----------
const grp = (d) => {
  const m = new Map();
  for (const r of rows(d, "indexes.tsv")) {
    const k = `${r[0]}.${r[1]}`;
    if (!m.has(k)) m.set(k, { uniq: r[2], cols: [] });
    m.get(k).cols.push(`${r[3]}:${r[4]}`);
  }
  return m;
};
const iA = grp(dirA); const iB = grp(dirB);
for (const k of new Set([...iA.keys(), ...iB.keys()])) {
  if (!iA.has(k)) { push("C_existence", `索引仅存在于右：${k}`); continue; }
  if (!iB.has(k)) { push("C_existence", `索引仅存在于左：${k}`); continue; }
  const a = iA.get(k); const b = iB.get(k);
  if (a.uniq !== b.uniq) push("D_other", `索引 ${k} 唯一性：${a.uniq} vs ${b.uniq}`);
  if (a.cols.join(",") !== b.cols.join(",")) push("D_other", `索引 ${k} 列：${a.cols.join(",")} vs ${b.cols.join(",")}`);
}

// ---------- fks ----------
const fA = new Map(rows(dirA, "fks.tsv").map((r) => [`${r[0]}.${r[4]}`, r]));
const fB = new Map(rows(dirB, "fks.tsv").map((r) => [`${r[0]}.${r[4]}`, r]));
for (const k of new Set([...fA.keys(), ...fB.keys()])) {
  if (!fA.has(k)) { push("C_existence", `外键仅存在于右：${k} → ${fB.get(k)[2]}.${fB.get(k)[3]}`); continue; }
  if (!fB.has(k)) { push("C_existence", `外键仅存在于左：${k} → ${fA.get(k)[2]}.${fA.get(k)[3]}`); continue; }
  const a = fA.get(k); const b = fB.get(k);
  const sig = (r) => `${r[1]}→${r[2]}.${r[3]} del=${normFkRule(r[6])} upd=${normFkRule(r[5])}`;
  if (sig(a) !== sig(b)) push("D_other", `外键 ${k}：${sig(a)} vs ${sig(b)}`);
  else if (r6sig(a) !== r6sig(b)) push("N7_fkRule", `外键 ${k} 更新/删除规则显示差异：del=${a[6]}/upd=${a[5]} vs del=${b[6]}/upd=${b[5]}`);
}
function r6sig(r) { return `${r[6]}|${r[5]}`; }

const lines = [];
lines.push(`# 结构快照对比：${title}`);
lines.push("");
lines.push(`- 左（A）：${dirA}`);
lines.push(`- 右（B）：${dirB}`);
lines.push("");
lines.push(`| 类别 | 条数 | 含义 |`);
lines.push(`|---|---|---|`);
lines.push(`| C | **${cls.C_existence.length}** | 表/列/索引/外键**存在性**差异 → 真实结构差异 |`);
lines.push(`| D | **${cls.D_other.length}** | 其余字段差异 → 需人工核对 |`);
lines.push(`| A | ${cls.A_intWidth.length} | 仅整数显示宽度不同（MySQL 8.0.19+ 移除 int(11)/bigint(20) 显示宽度，MariaDB 保留）→ 引擎天然差异 |`);
lines.push(`| B | ${cls.B_collation.length} | 排序规则 utf8mb4_0900_ai_ci ↔ utf8mb4_general_ci → 引擎天然差异 |`);
lines.push(`| N3 | ${cls.N3_nullRepr.length} | 默认值 NULL 显示形式（\`<NULL>\`(本装置占位) ↔ \`NULL\`）→ 引擎/客户端天然差异 |`);
lines.push(`| N4 | ${cls.N4_tsRepr.length} | CURRENT_TIMESTAMP 大小写·括号形式与 EXTRA 的 DEFAULT_GENERATED 标志 → 引擎天然差异 |`);
lines.push(`| N5 | ${cls.N5_quoteDefault.length} | 默认值引号（X ↔ 'X'、空串 ↔ ''）→ 引擎天然差异 |`);
lines.push(`| N6 | ${cls.N6_jsonAlias.length} | JSON ↔ LONGTEXT（MariaDB 把 JSON 实现为 LONGTEXT 别名，连带字符集字段）→ 引擎天然差异 |`);
lines.push(`| N7 | ${cls.N7_fkRule.length} | 外键更新规则 NO ACTION ↔ RESTRICT 显示差异 → 引擎天然差异 |`);
lines.push("");
lines.push(`## C 类（真实差异，全量）`);
lines.push("");
if (cls.C_existence.length === 0) lines.push("（无）");
for (const s of cls.C_existence) lines.push(`- ${s}`);
lines.push("");
lines.push(`## D 类（需人工核对，全量）`);
lines.push("");
if (cls.D_other.length === 0) lines.push("（无）");
for (const s of cls.D_other) lines.push(`- ${s}`);
lines.push("");
lines.push(`## 引擎天然差异（A/B/N3~N7）样例，每类前 8 条`);
lines.push("");
for (const k of ["A_intWidth", "B_collation", "N3_nullRepr", "N4_tsRepr", "N5_quoteDefault", "N6_jsonAlias", "N7_fkRule"]) {
  lines.push(`### ${k}（${cls[k].length} 条）`);
  lines.push("");
  lines.push(...(cls[k].length ? cls[k].slice(0, 8).map((s) => `- ${s}`) : ["（无）"]));
  lines.push("");
}

const out = lines.join("\n");
writeFileSync(outPath, out, "utf8");
console.log(out);
