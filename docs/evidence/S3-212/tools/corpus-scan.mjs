#!/usr/bin/env node
/**
 * S3-212 迁移语料「列类型/形状」扫描装置（只读，带精确字符偏移）
 *
 * 用法：node corpus-scan.mjs <repo> <outJson>
 *
 * 执行顺序口径（S3-212 更正版；与 S3-194 fk-scan.mjs 的"migration.ts 一律最先"不同）：
 *   backend/src/shared/migration.ts 的内嵌 DDL **分布在两个阶段**：
 *     · 第0步/第1步（`第1.5步` 之前）        → order 0
 *     · 第5.5步及之后（`第1.5步` 之后）        → order 2
 *   docs/init_database.sql（第1.5步）          → order 1
 *   docs/migrations/*.sql（第8步，文件名升序） → order 10+i
 * 依据：migration.ts:606「第1.5步：从 init_database.sql 创建所有业务表」、:763「第5.5步：创建缺失的表」。
 * 实测佐证：t_store_control_config 运行期结构 == init_database.sql:288 的定义（而非 migration.ts:791 的
 *   5.5.1b 兜底定义），见 docs/evidence/S3-212/README.md §二.3。
 * 同一张表的"有效定义" = 真实执行顺序最靠前的那一块（其后同表 CREATE TABLE IF NOT EXISTS 整条 no-op）。
 *
 * 输出：blocks[]（含每列 typeToken 的绝对字符偏移 start/end）、divergences[]（同表多定义 ⇒ 同列异型）。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const outJson = process.argv[3];
if (!repo || !outJson) {
  console.error("用法: node corpus-scan.mjs <repo> <outJson>");
  process.exit(2);
}

const SERVER_DEFAULT_COLLATION = "utf8mb4_0900_ai_ci";

function splitTopLevelWithOffsets(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  let start = 0;
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
    if (ch === "," && depth === 0) { parts.push({ text: cur, start }); cur = ""; i++; start = i; continue; }
    cur += ch;
    i++;
  }
  if (cur.trim()) parts.push({ text: cur, start });
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
migFiles.forEach((f, i) => sources.push({ file: `docs/migrations/${f}`, order: 10 + i, text: readFileSync(join(migDir, f), "utf8") }));
sources.push({ file: "docs/init_database.sql", order: 1, text: readFileSync(join(repo, "docs", "init_database.sql"), "utf8") });
sources.push({ file: "backend/src/shared/migration.ts", order: 0, text: readFileSync(join(repo, "backend", "src", "shared", "migration.ts"), "utf8") });

// migration.ts：第5.5步及之后的兜底建表在 init_database.sql（第1.5步）之后 ⇒ order=2
const MIG_TS = "backend/src/shared/migration.ts";
const INIT_DB_STEP_LINE = 606; // 「第1.5步：从 init_database.sql 创建所有业务表」
const STEP55_LINE = 763;       // 「第5.5步：创建缺失的表 + 添加缺失的字段」
const orderOfMigrationTsLine = (lineNo) => {
  if (lineNo < INIT_DB_STEP_LINE) return 0;   // 第0/1步：先于 init_database
  if (lineNo >= STEP55_LINE) return 2;        // 第5.5步及之后：晚于 init_database
  return 3;                                   // 夹在 1.5~5.5 之间（当前语料无建表块），保守放在 init 之后
};

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
    const columns = [];
    for (const part of splitTopLevelWithOffsets(body)) {
      const p = part.text.trim();
      if (!p) continue;
      if (/^(PRIMARY\s+KEY|UNIQUE\s+KEY|UNIQUE\s+INDEX|INDEX|KEY|FULLTEXT|SPATIAL|CONSTRAINT|CHECK|FOREIGN\s+KEY)\b/i.test(p)) continue;
      const colM = /^([`a-zA-Z_][`a-zA-Z0-9_]*)\s+([A-Za-z]+(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?)/.exec(p);
      if (!colM) continue;
      const cname = bare(colM[1]);
      const rawType = colM[2].replace(/\s+/g, " ").trim();
      const unsigned = /UNSIGNED$/i.test(rawType);
      const type = rawType.replace(/\s*UNSIGNED$/i, "").trim();
      // 类型 token 在文件中的绝对偏移：part.start 是相对 body 的偏移（body 从 openIdx+1 开始）
      const relInPart = part.text.indexOf(rawType, colM[0].length - colM[2].length - 1);
      const absStart = openIdx + 1 + part.start + relInPart;
      const cCsM = /CHARACTER\s+SET\s+([a-zA-Z0-9_]+)/i.exec(p);
      const cCollM = /COLLATE\s+([a-zA-Z0-9_]+)/i.exec(p);
      columns.push({
        name: cname,
        typeToken: rawType,
        type,
        unsigned,
        charset: cCsM ? cCsM[1].toLowerCase() : null,
        collate: cCollM ? cCollM[1].toLowerCase() : null,
        typeStart: absStart,
        typeEnd: absStart + rawType.length,
        line: lineOf(src.text, absStart),
      });
    }
    const blockLine = lineOf(src.text, m.index);
    blocks.push({
      file: src.file,
      order: src.file === MIG_TS ? orderOfMigrationTsLine(blockLine) : src.order,
      line: blockLine,
      table: name,
      charset: csM ? csM[1].toLowerCase() : null,
      collate: collM ? collM[1].toLowerCase() : null,
      columns,
    });
  }
}

const effective = new Map();
for (const b of blocks) {
  const cur = effective.get(b.table);
  if (!cur || b.order < cur.order) effective.set(b.table, b);
}

const byTable = new Map();
for (const b of blocks) {
  if (!byTable.has(b.table)) byTable.set(b.table, []);
  byTable.get(b.table).push(b);
}

const divergences = [];
for (const [tname, list] of byTable) {
  if (list.length < 2) continue;
  const colNames = new Set();
  for (const b of list) for (const c of b.columns) colNames.add(c.name);
  for (const cname of colNames) {
    const seen = new Map();
    for (const b of list) {
      const col = b.columns.find((c) => c.name === cname);
      if (!col) continue;
      const sig = `${col.type}${col.unsigned ? " UNSIGNED" : ""}`;
      if (!seen.has(sig)) seen.set(sig, []);
      seen.get(sig).push({
        file: b.file,
        line: col.line,
        order: b.order,
        effective: effective.get(tname) === b,
        typeToken: col.typeToken,
        typeStart: col.typeStart,
        typeEnd: col.typeEnd,
      });
    }
    if (seen.size > 1) {
      divergences.push({
        table: tname,
        column: cname,
        variants: [...seen.entries()].map(([sig, where]) => ({ sig, where })),
      });
    }
  }
}

const payload = {
  repo,
  sourceCount: sources.length,
  blockCount: blocks.length,
  tableCount: byTable.size,
  divergences,
  blocks,
  effective: [...effective.entries()].map(([t, b]) => ({ table: t, file: b.file, line: b.line, order: b.order })),
};
writeFileSync(outJson, JSON.stringify(payload, null, 1), "utf8");
console.log(`sources=${sources.length} blocks=${blocks.length} tables=${byTable.size} divergences=${divergences.length}`);
console.log(`[写出] ${outJson}`);
