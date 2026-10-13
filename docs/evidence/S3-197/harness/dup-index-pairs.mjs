/**
 * S3-197 装置③：找出**同表 + 同列集合 + 同唯一性、仅命名不同**的重复索引（冗余索引）。
 *
 * 判据来自 information_schema.STATISTICS（库内真实读数，不做源码顺序推理）。
 * 用法：node docs/evidence/S3-197/harness/dup-index-pairs.mjs <库名> [输出tsv]
 * 退出码：存在重复索引组 ⇒ 1；否则 0。
 */
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const [, , dbName, outFile] = process.argv;
if (!dbName) throw new Error("用法: dup-index-pairs.mjs <库名> [输出tsv]");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3455),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});

const [rows] = await conn.query(
  `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
          GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS cols
     FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
    ORDER BY TABLE_NAME, INDEX_NAME`
);
await conn.end();

const groups = new Map();
for (const r of rows) {
  const key = `${r.TABLE_NAME}|${r.cols}|${r.NON_UNIQUE}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r.INDEX_NAME);
}

const dup = [...groups.entries()].filter(([, names]) => names.length > 1).sort();
const lines = ["表\t列\t唯一性\t索引名（同名集合）"];
for (const [key, names] of dup) {
  const [table, cols, nonUnique] = key.split("|");
  lines.push(`${table}\t${cols}\t${nonUnique === "0" ? "UNIQUE" : "普通"}\t${names.join(" , ")}`);
}
lines.push(`-- 汇总：索引总数 ${rows.length} / 重复组 ${dup.length} / 重复组内索引数 ${dup.reduce((n, [, x]) => n + x.length, 0)}`);
const report = lines.join("\n");
console.log(report);
if (outFile) writeFileSync(outFile, report + "\n", "utf8");
process.exit(dup.length > 0 ? 1 : 0);
