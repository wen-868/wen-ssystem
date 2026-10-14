/**
 * S3-197 装置⑦：全语料扫描「tenant_id 索引命名双轨族」的**完整影响面**。
 *
 * 族定义（判据）：
 *   某条语料语句要建的索引名形如 `idx_<X>_tenant`，而同一张表上已存在规范命名
 *   `idx_t_<X>_tenant`（= migration.ts 第2步对 TENANT_TABLES 统一建的那套）⇒ 该语句建成后
 *   与规范索引**同表同列、仅命名不同**＝纯重复。
 *
 * 用法：node docs/evidence/S3-197/harness/tenant-index-family.mjs <仓库根> <库名> [输出tsv]
 * 退出码：命中重复 > 0 ⇒ 1。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const [, , repoArg, dbName, outFile] = process.argv;
if (!repoArg || !dbName) throw new Error("用法: tenant-index-family.mjs <仓库根> <库名> [输出tsv]");
const repo = resolve(repoArg);
const migDir = join(repo, "docs", "migrations");
const mod = await import(pathToFileURL(join(repo, "backend", "dist", "shared", "migration.js")).href);
const { splitSqlStatements, addTablePrefix } = mod;

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3456),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});
const [stat] = await conn.query(
  "SELECT TABLE_NAME t, INDEX_NAME i, COLUMN_NAME c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()"
);
await conn.end();
const have = new Set(stat.map((r) => `${r.t}|${r.i}|${r.c}`));

const files = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();
const rows = [];
for (const file of files) {
  const raw = readFileSync(join(migDir, file), "utf-8");
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  for (const stmt of splitSqlStatements(cleaned)) {
    const prefixed = addTablePrefix(stmt);
    // 只认"要建 tenant_id 索引"的语句（ADD INDEX / CREATE INDEX），索引名列在这里
    const m = prefixed.match(/(?:ADD\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX|CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX)\s+`?(idx_[A-Za-z0-9_]+)`?/i);
    if (!m) continue;
    const name = m[1];
    if (!/_tenant$/.test(name)) continue;
    // 目标表
    const t = (prefixed.match(/ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i) || [])[1]
      || (prefixed.match(/\bON\s+`?([A-Za-z0-9_]+)`?\s*\(/i) || [])[1]
      || (prefixed.match(/@s3186_tbl\s*=\s*'([A-Za-z0-9_]+)'/) || [])[1]
      || "";
    if (!t) continue;
    if (name === `idx_${t}_tenant`) continue; // 已是规范名
    const canonical = `idx_${t}_tenant`;
    const legacyExists = have.has(`${t}|${name}|tenant_id`);
    const canonicalExists = have.has(`${t}|${canonical}|tenant_id`);
    if (!legacyExists) continue; // 该语句实际没建出这个索引（跳过/失败）⇒ 不构成本库的重复
    const line = raw.split("\n").findIndex((l) => l.includes(`'${name}'`) || l.includes(`INDEX ${name}`)) + 1;
    rows.push({
      file,
      line,
      table: t,
      index: name,
      canonical,
      verdict: canonicalExists ? "重复（与规范索引同表同列）" : "非重复（本库无规范索引）",
    });
  }
}

const dup = rows.filter((r) => r.verdict.startsWith("重复"));
const lines = ["文件\t行号\t表\t语料索引名\t规范索引名\t定性"];
for (const r of rows) lines.push(`${r.file}\t${r.line}\t${r.table}\t${r.index}\t${r.canonical}\t${r.verdict}`);
lines.push(`-- 汇总：命中语句 ${rows.length} / 其中构成重复 ${dup.length} / 非重复 ${rows.length - dup.length}`);
lines.push(`-- 构成重复的按文件：${[...new Set(dup.map((r) => r.file))].map((f) => `${f}(${dup.filter((r) => r.file === f).length})`).join(" ")}`);
const report = lines.join("\n");
console.log(report);
if (outFile) writeFileSync(outFile, report + "\n", "utf8");
process.exit(dup.length > 0 ? 1 : 0);
