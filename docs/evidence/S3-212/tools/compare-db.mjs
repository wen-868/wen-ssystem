#!/usr/bin/env node
/**
 * S3-212 两库结构对照（只读）
 * 用法：node compare-db.mjs <host> <port> <dbA> <dbB> <outMd>
 * 对照对象：表清单 / 列（名、序、类型、可空、默认值、排序规则、EXTRA）/ 索引 / 外键
 */
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const [, , host, port, dbA, dbB, outMd] = process.argv;
if (!host || !port || !dbA || !dbB || !outMd) {
  console.error("用法: node compare-db.mjs <host> <port> <dbA> <dbB> <outMd>");
  process.exit(2);
}

const conn = await mysql.createConnection({ host, port: Number(port), user: "root", password: "", multipleStatements: true });
const q = async (sql, params) => (await conn.query(sql, params))[0];

async function readSchema(db) {
  const tables = await q("SELECT TABLE_NAME, TABLE_COMMENT, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [db]);
  const columns = await q("SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME, EXTRA, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME, ORDINAL_POSITION", [db]);
  const indexes = await q("SELECT TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX", [db]);
  const fks = await q("SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME", [db]);
  return { tables, columns, indexes, fks };
}

const A = await readSchema(dbA);
const B = await readSchema(dbB);
const key = (o, fields) => fields.map((f) => String(o[f] ?? "")).join("|");

const diff = [];
const report = [];
report.push(`# 结构对照：${dbA} vs ${dbB}`);
report.push("");
report.push(`- 表数：${A.tables.length} vs ${B.tables.length}`);
report.push(`- 列数：${A.columns.length} vs ${B.columns.length}`);
report.push(`- 索引行数：${A.indexes.length} vs ${B.indexes.length}`);
report.push(`- 外键行数：${A.fks.length} vs ${B.fks.length}`);
report.push("");

function diffSection(name, a, b, fields, labelFn) {
  const ma = new Map(a.map((r) => [key(r, fields), r]));
  const mb = new Map(b.map((r) => [key(r, fields), r]));
  const onlyA = [...ma.values()].filter((r) => !mb.has(key(r, fields)));
  const onlyB = [...mb.values()].filter((r) => !ma.has(key(r, fields)));
  report.push(`## ${name}：仅 ${dbA} 有 ${onlyA.length} 条 / 仅 ${dbB} 有 ${onlyB.length} 条`);
  report.push("");
  for (const r of onlyA) report.push(`- A: ${labelFn(r)}`);
  for (const r of onlyB) report.push(`- B: ${labelFn(r)}`);
  report.push("");
  diff.push({ section: name, onlyA: onlyA.length, onlyB: onlyB.length });
}

diffSection("表", A.tables, B.tables, ["TABLE_NAME"], (r) => r.TABLE_NAME);
diffSection(
  "列",
  A.columns,
  B.columns,
  ["TABLE_NAME", "COLUMN_NAME", "COLUMN_TYPE", "IS_NULLABLE", "COLUMN_DEFAULT", "COLLATION_NAME", "EXTRA", "ORDINAL_POSITION"],
  (r) => `${r.TABLE_NAME}.${r.COLUMN_NAME} #${r.ORDINAL_POSITION} ${r.COLUMN_TYPE} null=${r.IS_NULLABLE} def=${r.COLUMN_DEFAULT} coll=${r.COLLATION_NAME} extra=${r.EXTRA}`
);
diffSection("索引", A.indexes, B.indexes, ["TABLE_NAME", "INDEX_NAME", "SEQ_IN_INDEX", "COLUMN_NAME", "NON_UNIQUE"], (r) => `${r.TABLE_NAME}.${r.INDEX_NAME}(${r.SEQ_IN_INDEX}) → ${r.COLUMN_NAME} unique=${r.NON_UNIQUE === 0}`);
diffSection("外键", A.fks, B.fks, ["TABLE_NAME", "CONSTRAINT_NAME", "COLUMN_NAME", "REFERENCED_TABLE_NAME", "REFERENCED_COLUMN_NAME"], (r) => `${r.TABLE_NAME}.${r.CONSTRAINT_NAME}: ${r.COLUMN_NAME} → ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`);

report.push("## 汇总");
report.push("");
for (const d of diff) report.push(`- ${d.section}: A-only=${d.onlyA} B-only=${d.onlyB}`);
writeFileSync(outMd, report.join("\n"), "utf8");
await conn.end();
console.log(report.slice(0, 8).join("\n"));
console.log(`[写出] ${outMd}`);
