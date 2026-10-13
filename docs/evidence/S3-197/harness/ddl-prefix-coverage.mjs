/**
 * S3-197 装置⑩：全语料扫描"**DDL 位置表名未补 t_ 前缀**"这一族的**完整影响面**。
 *
 * 做法：对每条语句，分别过「修复前 addTablePrefix」与「修复后 addTablePrefix」，
 * 用同一组 DDL 位置正则提取表名，报告：命中条数 / 其中表名缺前缀条数 / 修复后是否被补上。
 * ⇒ 给出"已修 N 处 / 仍受影响 M 处"的数字（技术债铁律 §1、§2）。
 *
 * 用法：node docs/evidence/S3-197/harness/ddl-prefix-coverage.mjs <修复前仓库根> <修复后仓库根> [输出tsv] [语料仓库根]
 *   第 4 个参数用于"语料取自某棵树、两个 dist 取自另两棵树"的情形（例如语料要取**未改 093** 的那棵树）。
 * 退出码：仍受影响（仍缺前缀）> 0 ⇒ 1。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , beforeRepo, afterRepo, outFile, corpusRepoArg] = process.argv;
if (!beforeRepo || !afterRepo) throw new Error("用法: ddl-prefix-coverage.mjs <修复前仓库根> <修复后仓库根> [输出tsv] [语料仓库根]");
const load = async (repo) => import(pathToFileURL(join(resolve(repo), "backend", "dist", "shared", "migration.js")).href);
const beforeMod = await load(beforeRepo);
const afterMod = await load(afterRepo);

/** 位置名 → 从 SQL 文本里抓「该位置上的表名」 */
const POSITIONS = {
  "CREATE TABLE": /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i,
  "ALTER TABLE": /ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i,
  "CREATE INDEX … ON": /CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s+`?[A-Za-z0-9_]+`?\s+ON\s+`?([A-Za-z0-9_]+)`?/i,
  "DROP INDEX … ON": /DROP\s+INDEX\s+`?[A-Za-z0-9_]+`?\s+ON\s+`?([A-Za-z0-9_]+)`?/i,
  "RENAME TABLE": /RENAME\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i,
  "DROP TABLE": /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i,
  "INSERT INTO": /INSERT\s+(?:IGNORE\s+)?INTO\s+`?([A-Za-z0-9_]+)`?/i,
  "REPLACE INTO": /REPLACE\s+INTO\s+`?([A-Za-z0-9_]+)`?/i,
  "UPDATE(语句首)": /(?:^|\n)\s*UPDATE\s+`?([A-Za-z0-9_]+)`?/i,
  "DELETE FROM": /DELETE\s+FROM\s+`?([A-Za-z0-9_]+)`?/i,
  "FROM": /\bFROM\s+`?([A-Za-z0-9_]+)`?/i,
  "JOIN": /\bJOIN\s+`?([A-Za-z0-9_]+)`?/i,
  "REFERENCES": /\bREFERENCES\s+`?([A-Za-z0-9_]+)`?/i,
  "TRUNCATE": /\bTRUNCATE\s+(?:TABLE\s+)?`?([A-Za-z0-9_]+)`?/i,
  "LOCK TABLES": /\bLOCK\s+TABLES\s+`?([A-Za-z0-9_]+)`?/i,
  "ANALYZE TABLE": /\bANALYZE\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i,
  "OPTIMIZE TABLE": /\bOPTIMIZE\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i,
  "CREATE TRIGGER … ON": /CREATE\s+TRIGGER\s+`?[A-Za-z0-9_]+`?\s+[^\n]*?\bON\s+`?([A-Za-z0-9_]+)`?/i,
  "SET @s3186_tbl='…'(字符串字面量)": /@s3186_tbl\s*=\s*'([A-Za-z0-9_]+)'/,
};
const needsPrefix = (t) => !!t && !t.startsWith("t_") && !t.startsWith("information_schema") && !t.startsWith("mysql") && !t.startsWith("performance_schema") && !t.startsWith("sys");

const migDir = join(resolve(corpusRepoArg || beforeRepo), "docs", "migrations");
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql").sort();
const hits = new Map(); // 位置 → {命中, 缺前缀前, 修复后仍缺, 样本:[]}
for (const key of Object.keys(POSITIONS)) hits.set(key, { hit: 0, bareBefore: 0, bareAfter: 0, fixed: 0, samples: [] });

for (const file of files) {
  const sql = readFileSync(join(migDir, file), "utf-8");
  const cleaned = sql.split("\n").filter((l) => !l.trim().toUpperCase().startsWith("USE ")).join("\n");
  for (const stmt of beforeMod.splitSqlStatements(cleaned)) {
    const b = beforeMod.addTablePrefix(stmt);
    const a = afterMod.addTablePrefix(stmt);
    for (const [key, re] of Object.entries(POSITIONS)) {
      const mb = b.match(re);
      if (!mb) continue;
      const rec = hits.get(key);
      rec.hit += 1;
      const bareBefore = needsPrefix(mb[1]);
      if (!bareBefore) continue;
      rec.bareBefore += 1;
      const ma = a.match(re);
      const bareAfter = needsPrefix(ma ? ma[1] : "");
      if (bareAfter) rec.bareAfter += 1;
      else rec.fixed += 1;
      if (rec.samples.length < 4) rec.samples.push(`${file} | ${mb[1]} → ${ma ? ma[1] : "?"}`);
    }
  }
}

const lines = ["DDL 位置\t命中语句\t表名缺前缀(修复前)\t修复后已补\t修复后仍缺\t样本"];
let still = 0;
for (const [key, rec] of hits) {
  if (rec.bareBefore === 0 && rec.bareAfter === 0) continue;
  still += rec.bareAfter;
  lines.push(`${key}\t${rec.hit}\t${rec.bareBefore}\t${rec.fixed}\t${rec.bareAfter}\t${rec.samples.join(" ; ")}`);
}
lines.push(`-- 汇总：表名缺前缀命中总条数 ${[...hits.values()].reduce((n, r) => n + r.bareBefore, 0)} / 修复后被补上 ${[...hits.values()].reduce((n, r) => n + r.fixed, 0)} / 修复后仍缺（含字符串字面量里的表名，产品结构性看不到）${still}`);
const report = lines.join("\n");
console.log(report);
if (outFile) writeFileSync(outFile, report + "\n", "utf8");
const structuralBlindSpots = [...hits.entries()].filter(([, r]) => r.bareAfter > 0).map(([k]) => k);
console.log(`-- 产品 addTablePrefix 结构性看不到的位置：${structuralBlindSpots.length ? structuralBlindSpots.join("、") : "无"}`);
process.exit(structuralBlindSpots.filter((k) => !k.includes("字符串")).length > 0 ? 1 : 0);
