#!/usr/bin/env node
/**
 * S3-194 全语料外键一致性扫描装置（只读，v2）
 *
 * 用法：node fk-scan.mjs <repo> <outDir>
 *
 * v2 相对 v1 的修正（v1 把"同表多份定义"按最后一份取值，产生 2 条假红）：
 *   1) 每个 CREATE TABLE 块按 runner 真实执行顺序编号：
 *        order 0     = backend/src/shared/migration.ts 内嵌 DDL（第 0~5.5 步，最先执行）
 *        order 1     = docs/init_database.sql（第 1.5 步）
 *        order 100+i = docs/migrations/*.sql，文件名 .sort() 升序（第 8 步，与 runner 一致）
 *   2) 同一张表的有效定义 = 执行顺序最靠前的那一块（后续同表 CREATE TABLE IF NOT EXISTS 整条 no-op）；
 *   3) 外键判定用"声明它的那一块里的子列定义" × "父表的有效定义"；
 *   4) 单独输出"同表多定义 ⇒ 同列异型"分歧清单（跨文件一致性扫描结果）。
 *
 * 口径：表名按 addTablePrefix 语义归一（裸名 x → t_x）；未显式声明 COLLATE 的表/列按
 * MySQL 8 服务器默认 utf8mb4_0900_ai_ci 归一（两侧同源默认视为相等，显式与默认混用按不相等保守判定）；
 * 字符串列要求"同类型 + 同有效排序规则"，数值列要求"同类型 + 同有符号性"（与 errno 3780 一致）。
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const outDir = process.argv[3] ?? ".";
mkdirSync(outDir, { recursive: true });

const SERVER_DEFAULT_COLLATION = "utf8mb4_0900_ai_ci";

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      cur += ch;
      i++;
      while (i < body.length) {
        const c = body[i];
        cur += c;
        if (c === "\\") { i++; if (i < body.length) { cur += body[i]; i++; } continue; }
        i++;
        if (c === quote) {
          if (body[i] === quote) { cur += body[i]; i++; continue; }
          break;
        }
      }
      continue;
    }
    if (ch === "-" && body[i + 1] === "-") { while (i < body.length && body[i] !== "\n") { cur += body[i]; i++; } continue; }
    if (ch === "(") { depth++; cur += ch; i++; continue; }
    if (ch === ")") { depth--; cur += ch; i++; continue; }
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; i++; continue; }
    cur += ch;
    i++;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function matchParen(sql, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i++;
      while (i < sql.length) {
        if (sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") { while (i < sql.length && sql[i] !== "\n") i++; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;
const bare = (s) => (s ?? "").replace(/[`\s]/g, "");
const withPrefix = (t) => {
  const n = bare(t);
  if (!n) return n;
  if (n.startsWith("t_") || n.startsWith("information_schema") || n.startsWith("mysql")) return n;
  return "t_" + n;
};

const sources = [];
const migDir = join(repo, "docs", "migrations");
const migFiles = readdirSync(migDir).filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql").sort();
migFiles.forEach((f, i) => sources.push({ file: `docs/migrations/${f}`, order: 100 + i, text: readFileSync(join(migDir, f), "utf8") }));
sources.push({ file: "docs/init_database.sql", order: 1, text: readFileSync(join(repo, "docs", "init_database.sql"), "utf8") });
sources.push({ file: "backend/src/shared/migration.ts", order: 0, text: readFileSync(join(repo, "backend", "src", "shared", "migration.ts"), "utf8") });

const blocks = [];
const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`a-zA-Z_][`a-zA-Z0-9_]*)\s*\(/gi;
for (const src of sources) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(src.text)) !== null) {
    const name = withPrefix(m[1]);
    const openIdx = src.text.indexOf("(", m.index + m[0].length - 1);
    const closeIdx = matchParen(src.text, openIdx);
    if (closeIdx < 0) continue;
    const body = src.text.slice(openIdx + 1, closeIdx);
    const suffixEnd = src.text.indexOf(";", closeIdx);
    const suffix = src.text.slice(closeIdx + 1, suffixEnd < 0 ? src.text.length : suffixEnd);
    const csM = /CHARSET\s*=\s*([a-zA-Z0-9_]+)/i.exec(suffix);
    const collM = /COLLATE\s*=\s*([a-zA-Z0-9_]+)/i.exec(suffix);
    const columns = new Map();
    const fks = [];
    for (const part of splitTopLevel(body)) {
      const p = part.trim();
      if (!p) continue;
      const fkM = /FOREIGN\s+KEY\s*\(\s*([`a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s*([`a-zA-Z0-9_]+)\s*\(\s*([`a-zA-Z0-9_]+)\s*\)/i.exec(p);
      if (fkM) {
        fks.push({ file: src.file, line: lineOf(src.text, openIdx) + p.split("\n").length - 1, table: name, col: bare(fkM[1]), refTable: withPrefix(fkM[2]), refCol: bare(fkM[3]) });
        continue;
      }
      if (/^(PRIMARY\s+KEY|UNIQUE\s+KEY|UNIQUE\s+INDEX|INDEX|KEY|FULLTEXT|SPATIAL|CONSTRAINT|CHECK)\b/i.test(p)) continue;
      const colM = /^([`a-zA-Z_][`a-zA-Z0-9_]*)\s+([A-Za-z]+(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?)/.exec(p);
      if (!colM) continue;
      const cname = bare(colM[1]);
      let type = colM[2].replace(/\s+/g, " ").trim();
      const unsigned = /UNSIGNED/i.test(type);
      type = type.replace(/\s*UNSIGNED/i, "").trim();
      const cCsM = /CHARACTER\s+SET\s+([a-zA-Z0-9_]+)/i.exec(p);
      const cCollM = /COLLATE\s+([a-zA-Z0-9_]+)/i.exec(p);
      const inlineFk = /REFERENCES\s+([`a-zA-Z0-9_]+)\s*\(\s*([`a-zA-Z0-9_]+)\s*\)/i.exec(p);
      if (inlineFk) fks.push({ file: src.file, line: lineOf(src.text, openIdx) + p.split("\n").length - 1, table: name, col: cname, refTable: withPrefix(inlineFk[1]), refCol: bare(inlineFk[2]) });
      columns.set(cname, { type, unsigned, charset: cCsM ? cCsM[1].toLowerCase() : null, collate: cCollM ? cCollM[1].toLowerCase() : null });
    }
    blocks.push({
      file: src.file, order: src.order, line: lineOf(src.text, m.index), table: name,
      charset: csM ? csM[1].toLowerCase() : null, collate: collM ? collM[1].toLowerCase() : null,
      columns, fks,
    });
  }
}

const effective = new Map();
for (const b of blocks) {
  const cur = effective.get(b.table);
  if (!cur || b.order < cur.order) effective.set(b.table, b);
}

const isStringType = (t) => /^(CHAR|VARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|ENUM|SET|BINARY|VARBINARY)/i.test(t);
const isNumericType = (t) => /^(TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|BIT)/i.test(t);
const effCollation = (blk, col) => {
  if (!col || !isStringType(col.type)) return null;
  if (col.collate) return col.collate;
  if (blk?.collate) return blk.collate;
  if (blk?.charset && blk.charset !== "utf8mb4") return `<charset ${blk.charset} 默认>`;
  return SERVER_DEFAULT_COLLATION;
};

const allFks = blocks.flatMap((b) => b.fks.map((fk) => ({ ...fk, block: b, isEffectiveBlock: effective.get(b.table) === b })));

const results = allFks.map((fk) => {
  const child = fk.block;
  const parent = effective.get(fk.refTable);
  const c = child.columns.get(fk.col);
  const p = parent?.columns.get(fk.refCol);
  let verdict = "unknown";
  const detail = [];
  if (!c) detail.push(`子列未在声明块内定义；`);
  if (!p) detail.push(`父表 ${fk.refTable} 无有效定义或缺列 ${fk.refCol}；`);
  if (c && p) {
    if (c.type.toUpperCase() !== p.type.toUpperCase()) { verdict = "incompatible"; detail.push(`类型不一致 ${c.type} vs ${p.type}`); }
    else if (c.unsigned !== p.unsigned) { verdict = "incompatible"; detail.push(`有符号性不一致 UNSIGNED=${c.unsigned} vs ${p.unsigned}`); }
    else if (isStringType(c.type)) {
      const ec = effCollation(child, c);
      const ep = effCollation(parent, p);
      if (ec !== ep) { verdict = "incompatible"; detail.push(`排序规则不一致 ${ec} vs ${ep}`); }
      else { verdict = "compatible"; detail.push(`字符串列同型同序 ${c.type} / ${ec}`); }
    } else if (isNumericType(c.type)) { verdict = "compatible"; detail.push(`数值列同型 ${c.type}`); }
    else { verdict = "needsManual"; detail.push(`非字符串/数值类型 ${c.type}，装置不判定`); }
  }
  return {
    ...fk, childType: c ? c.type : null, parentType: p ? p.type : null,
    parentBlock: parent ? `${parent.file}:${parent.line}` : null,
    effective: fk.isEffectiveBlock, verdict, detail: detail.join(""),
  };
});

const byTable = new Map();
for (const b of blocks) {
  if (!byTable.has(b.table)) byTable.set(b.table, []);
  byTable.get(b.table).push(b);
}
const divergences = [];
for (const [tname, list] of byTable) {
  if (list.length < 2) continue;
  const cols = new Set();
  for (const b of list) for (const c of b.columns.keys()) cols.add(c);
  for (const c of cols) {
    const seen = new Map();
    for (const b of list) {
      const col = b.columns.get(c);
      if (!col) continue;
      const sig = `${col.type}${col.unsigned ? " UNSIGNED" : ""}`;
      if (!seen.has(sig)) seen.set(sig, []);
      seen.get(sig).push(`${b.file}:${b.line}${effective.get(tname) === b ? "(有效)" : ""}`);
    }
    if (seen.size > 1) divergences.push({ table: tname, column: c, variants: [...seen.entries()].map(([sig, where]) => ({ sig, where })) });
  }
}

const byVerdict = results.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] ?? 0) + 1), acc), {});
const redEffective = results.filter((r) => r.verdict === "incompatible" && r.effective);
const redShadowed = results.filter((r) => r.verdict === "incompatible" && !r.effective);

const fmt = (r) => `| ${r.file}:${r.line} | ${r.table}.${r.col} | ${r.refTable}.${r.refCol} (父定义 ${r.parentBlock}) | ${r.childType ?? "?"} | ${r.parentType ?? "?"} | ${r.verdict} | ${r.detail} |`;
const tenantCols = [];
const orderCols = [];
for (const b of blocks) for (const [cname, c] of b.columns) {
  if (cname === "tenant_id") tenantCols.push(`${b.table}.tenant_id = ${c.type}${c.unsigned ? " UNSIGNED" : ""}  (${b.file}:${b.line}${effective.get(b.table) === b ? " 有效" : ""})`);
  if (cname === "order_id") orderCols.push(`${b.table}.order_id = ${c.type}${c.unsigned ? " UNSIGNED" : ""}  (${b.file}:${b.line}${effective.get(b.table) === b ? " 有效" : ""})`);
}

const lines = [];
lines.push(`# S3-194 全语料外键一致性扫描（装置 fk-scan.mjs v2，只读）`);
lines.push("");
lines.push(`- repo: ${repo}`);
lines.push(`- 扫描源: ${sources.length} 个（docs/migrations/*.sql ${migFiles.length} 个 + docs/init_database.sql + backend/src/shared/migration.ts）`);
lines.push(`- CREATE TABLE 块: ${blocks.length} 处；归一后表: ${byTable.size} 张`);
lines.push(`- FOREIGN KEY 声明: ${results.length} 条；判定分布: ${JSON.stringify(byVerdict)}`);
lines.push(`- 红候选（有效定义，运行时必报 errno 3780）: **${redEffective.length} 条**`);
lines.push(`- 红候选（非有效块，前序建表失败后才执行）: ${redShadowed.length} 条`);
lines.push("");
lines.push(`## 一、红候选 · 有效定义（${redEffective.length} 条）`);
lines.push("");
lines.push(`| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const r of redEffective) lines.push(fmt(r));
lines.push("");
lines.push(`## 二、红候选 · 非有效块（前序建表失败后本块会执行 ⇒ 运行时同样报红）（${redShadowed.length} 条）`);
lines.push("");
lines.push(`| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const r of redShadowed) lines.push(fmt(r));
lines.push("");
lines.push(`## 三、判定 compatible 的外键（${results.filter((r) => r.verdict === "compatible").length} 条）`);
lines.push("");
lines.push(`| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const r of results.filter((x) => x.verdict === "compatible")) lines.push(fmt(r));
lines.push("");
lines.push(`## 四、同表多定义 ⇒ 同列异型（跨文件一致性分歧，${divergences.length} 组）`);
lines.push("");
lines.push(`| 表 | 列 | 变体 |`);
lines.push(`|---|---|---|`);
for (const d of divergences) lines.push(`| ${d.table} | ${d.column} | ${d.variants.map((v) => `\`${v.sig}\` ← ${v.where.join(" / ")}`).join("  ｜  ")} |`);
lines.push("");
lines.push(`## 五、全语料 tenant_id 列登记（${tenantCols.length} 处）`);
lines.push("");
lines.push("```");
lines.push(...tenantCols);
lines.push("```");
lines.push("");
lines.push(`## 六、全语料 order_id 列登记（${orderCols.length} 处）`);
lines.push("");
lines.push("```");
lines.push(...orderCols);
lines.push("```");

const report = lines.join("\n");
writeFileSync(join(outDir, "fk-scan.md"), report, "utf8");
writeFileSync(join(outDir, "fk-scan.json"), JSON.stringify({ blocks: blocks.map((b) => ({ ...b, columns: [...b.columns.entries()], fks: b.fks })), results, divergences, byVerdict }, null, 2), "utf8");
console.log(report.split("\n").slice(0, 46).join("\n"));
console.log(`\n[写出] ${join(outDir, "fk-scan.md")} / fk-scan.json（全量报告）`);
