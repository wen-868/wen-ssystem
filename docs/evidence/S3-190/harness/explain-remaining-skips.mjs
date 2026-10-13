/**
 * S3-190 装置⑦：给"修复后日志里**仍然**存在的 ER_NO_SUCH_TABLE 跳过"定性——
 * 证明剩下的跳过**不是**第 53 项那类"表名缺 t_ 前缀"缺陷，而是"目标表本就未建"的合法跳过。
 *
 * 做法：
 *   ① 从迁移日志里抽出 `<文件>.sql: 跳过 (ER_NO_SUCH_TABLE)` 的按文件计数；
 *   ② 对每个这样的文件，逐条解析 `SET @s3186_tbl = '<表名>', @s3186_name = '<对象名>';`，
 *      在目标库里查该表是否存在，并标出"表名缺 t_ 前缀"这一缺陷类是否命中；
 *   ③ 汇总：属"缺前缀缺陷"的条数（应为 0）+ 属"目标表未建"的条数。
 *
 * 用法：node docs/evidence/S3-190/harness/explain-remaining-skips.mjs <日志文件> <库名> [仓库根]
 * 退出码：缺前缀命中数 > 0 ⇒ 1；否则 0。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import mysql from "mysql2/promise";

const [, , logFile, dbName, repoArg] = process.argv;
if (!logFile || !dbName) {
  throw new Error("用法: explain-remaining-skips.mjs <日志文件> <库名> [仓库根]");
}
const repo = resolve(repoArg || process.cwd());
const migDir = join(repo, "docs", "migrations");
const knownFiles = new Set(readdirSync(migDir).filter((f) => f.endsWith(".sql")));

const perFile = new Map();
for (const line of readFileSync(logFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/\[migration\] (.+?\.sql): 跳过 \(ER_NO_SUCH_TABLE\)/);
  if (!m) continue;
  perFile.set(m[1], (perFile.get(m[1]) || 0) + 1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3406),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});
const tableExists = async (t) => {
  const [rows] = await conn.query(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [t]
  );
  return Number(rows[0].c) > 0;
};

console.log(`库 = ${dbName}`);
console.log(`日志 = ${logFile}`);
console.log("-- ① 按文件的 ER_NO_SUCH_TABLE 跳过计数 --");
console.log("文件\t跳过条数");
for (const [f, n] of [...perFile.entries()].sort()) console.log(`${f}\t${n}`);

let unprefixedHits = 0;
let absentTargets = 0;
let stmtTotal = 0;
console.log("-- ② 这些文件里的补列/补索引目标（表存在性 + 是否属「缺 t_ 前缀」缺陷类）--");
console.log("文件\t表名\t对象名\t表是否存在\t缺前缀缺陷类?");
for (const [file] of [...perFile.entries()].sort()) {
  if (!knownFiles.has(file)) {
    console.log(`${file}\t（非 docs/migrations 下的文件，跳过解析）\t\t\t`);
    continue;
  }
  const text = readFileSync(join(migDir, file), "utf8");
  // 两类写法都收：① S3-186 改写后的 `SET @s3186_tbl = '<表名>', @s3186_name = '<对象名>';`
  //            ② 文件里直接写的 `ALTER TABLE <表名>` / `CREATE TABLE [IF NOT EXISTS] <表名>`
  const targets = [];
  const reSet = /SET @s3186_tbl = '([A-Za-z0-9_]+)', @s3186_name = '([A-Za-z0-9_]+)';/g;
  let m;
  while ((m = reSet.exec(text)) !== null) targets.push([m[1], m[2]]);
  const reAlter = /(?:ALTER TABLE|CREATE TABLE(?: IF NOT EXISTS)?)\s+`?([A-Za-z0-9_]+)`?/g;
  while ((m = reAlter.exec(text)) !== null) targets.push([m[1], "（ALTER/CREATE 直写）"]);
  for (const [tbl, name] of targets) {
    stmtTotal += 1;
    const prefixedFixClass = !tbl.startsWith("t_");
    const exists = await tableExists(tbl);
    if (prefixedFixClass) unprefixedHits += 1;
    if (!exists) absentTargets += 1;
    console.log(`${file}\t${tbl}\t${name}\t${exists ? "存在" : "**不存在**"}\t${prefixedFixClass ? "**是（缺陷类命中）**" : "否"}`);
  }
}

console.log(`-- ③ 汇总 --`);
console.log(`解析到的结构语句目标总数 = ${stmtTotal}`);
console.log(`属"表名缺 t_ 前缀"缺陷类的条数 = ${unprefixedHits}`);
console.log(`目标表在**最终库中仍不存在**的条数（另有类别：历史遗留表名/未建表）= ${absentTargets}`);
console.log(`其余（表最终存在 ⇒ 跳过只可能来自"执行时点该表尚未建出"）= ${stmtTotal - unprefixedHits - absentTargets}`);
await conn.end();
process.exit(unprefixedHits > 0 ? 1 : 0);
