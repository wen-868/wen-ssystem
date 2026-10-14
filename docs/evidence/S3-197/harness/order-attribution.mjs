/**
 * S3-197 装置⑤：把某文件里每条结构语句的**目标表**归因到"哪一份语料文件建出它"。
 *
 * 用途：定性"执行时点"类跳过——语句本身没写错（表名带 t_ 前缀、语法合法），只是**执行到它时表还没建**。
 * 判据：目标表的建表文件号 > 本文件号（或全语料都没建）⇒ 属"执行时点/本产品不建"类，不是"表名缺前缀"缺陷类。
 *
 * 用法：node docs/evidence/S3-197/harness/order-attribution.mjs <仓库根> <文件名> [输出tsv]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , repoArg, fileName, outFile] = process.argv;
if (!repoArg || !fileName) throw new Error("用法: order-attribution.mjs <仓库根> <文件名> [输出tsv]");
const repo = resolve(repoArg);
const migDir = join(repo, "docs", "migrations");

const mod = await import(pathToFileURL(join(repo, "backend", "dist", "shared", "migration.js")).href);
const { splitSqlStatements, addTablePrefix, isDropTableStatement, firstKeyword } = mod;

const files = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();

/** 表名 → 定义它的文件（第一个 CREATE TABLE 出现的文件） */
const definer = new Map();
for (const file of files) {
  const text = addTablePrefix(readFileSync(join(migDir, file), "utf-8"));
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!definer.has(m[1])) definer.set(m[1], file);
  }
}

const targetText = readFileSync(join(migDir, fileName), "utf-8");
const cleaned = targetText
  .split("\n")
  .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
  .join("\n");
const statements = splitSqlStatements(cleaned);
const targetRe = /(?:ALTER\s+TABLE|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|CREATE\s+(?:UNIQUE\s+)?INDEX\s+\S+\s+ON|INSERT\s+(?:IGNORE\s+)?INTO|FROM|JOIN|UPDATE|DELETE\s+FROM|REFERENCES)\s+`?([A-Za-z0-9_]+)`?/i;
// S3-186 起，092/120a/137/138 等文件把补列/补索引写成「守卫式」动 SQL，表名在 SET 变量里
const setTblRe = /@s3186_tbl\s*=\s*'([A-Za-z0-9_]+)'/;

const lines = ["序号\t首关键字\t目标表\t建表文件\t定性"];
let later = 0;
let never = 0;
let normal = 0;
let lastTbl = ""; // 守卫式写法：SET 行给出表名，紧随其后的 PREPARE/EXECUTE/DEALLOCATE 沿用
statements.forEach((stmt, i) => {
  if (isDropTableStatement(stmt)) return;
  const prefixed = addTablePrefix(stmt);
  const m = prefixed.match(targetRe);
  const mSet = prefixed.match(setTblRe);
  if (mSet) lastTbl = mSet[1];
  const table = mSet ? mSet[1] : m ? m[1] : lastTbl;
  const def = definer.get(table) || "";
  let verdict;
  if (!def) {
    verdict = "该表全语料未建（本产品不建）";
    never += 1;
  } else if (def > fileName) {
    verdict = `执行时点表未建（由更晚文件 ${def} 建出）`;
    later += 1;
  } else {
    verdict = "建表文件不晚于本文件（正常）";
    normal += 1;
  }
  lines.push(`${i + 1}\t${firstKeyword(stmt)}\t${table}\t${def || "（无）"}\t${verdict}`);
});
lines.push(`-- 汇总：语句 ${statements.length} / 正常 ${normal} / 执行时点未建 ${later} / 全语料未建 ${never}`);
const report = lines.join("\n");
console.log(report);
if (outFile) writeFileSync(outFile, report + "\n", "utf8");
