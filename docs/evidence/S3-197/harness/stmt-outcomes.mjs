/**
 * S3-197 装置②：**语句级**台账——把外部迁移语料按产品 runner 的顺序与判据逐条重放，逐条记录结果。
 *
 * 为什么需要：产品 runner 的日志只打「文件 + 错误码」（`[migration] xxx.sql: 跳过 (ER_NO_SUCH_TABLE)`），
 * 无法指出**是哪一条语句**被跳过；本装置给出语句级台账（文件 / 序号 / 首关键字 / 目标 / 错误码 / 原文）。
 *
 * 口径：判据全部**复用产品自己的导出函数**（splitSqlStatements / addTablePrefix / isDropTableStatement /
 * isDataWriteStatement / resolveWriteGate），不复制实现，避免与产品口径漂移。
 * 重放**强制**写闸门=block（数据写语句一律不落库），因此本装置只做结构语句的尝试。
 *
 * 用法：node docs/evidence/S3-197/harness/stmt-outcomes.mjs <仓库根> <库名> <输出jsonl> [日志文件]
 *   给了日志文件时：把重放得到的「按文件 ER_NO_SUCH_TABLE 条数」与真实运行日志对账，不一致即打印 MISMATCH。
 * 退出码：重放与日志对账不一致 ⇒ 1；否则 0。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const [, , repoArg, dbName, outFile, logFile] = process.argv;
if (!repoArg || !dbName || !outFile) {
  throw new Error("用法: stmt-outcomes.mjs <仓库根> <库名> <输出jsonl> [日志文件]");
}
const repo = resolve(repoArg);
const mod = await import(pathToFileURL(join(repo, "backend", "dist", "shared", "migration.js")).href);
const {
  splitSqlStatements,
  addTablePrefix,
  isDropTableStatement,
  isDataWriteStatement,
  firstKeyword,
  statementTarget,
  SKIP_ERRORS,
  SKIP_PATTERNS,
} = mod;

const migDir = join(repo, "docs", "migrations");
const files = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3455),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  multipleStatements: false,
});

const rows = [];
const skipByFile = new Map();
let executed = 0;
let skipped = 0;
let errors = 0;
let gateBlocked = 0;

for (const file of files) {
  const sql = readFileSync(join(migDir, file), "utf-8");
  // 与 runner 一致：只移除 USE 行（DELIMITER 行必须保留）
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  const statements = splitSqlStatements(cleaned);
  let index = 0;
  for (const stmt of statements) {
    index += 1;
    const keyword = firstKeyword(stmt);
    const target = statementTarget(stmt);
    const text = stmt.replace(/\s+/g, " ").slice(0, 200);
    if (isDropTableStatement(stmt)) {
      rows.push({ file, index, keyword, target, outcome: "DROP_PROTECTED", text });
      continue;
    }
    // 重放固定用 block：数据写语句与 CALL 一律不落库（与 run-case.ps1 默认口径一致）
    if (isDataWriteStatement(stmt)) {
      gateBlocked += 1;
      rows.push({ file, index, keyword, target, outcome: "WRITE_GATE_BLOCK", text });
      continue;
    }
    const prefixed = addTablePrefix(stmt);
    try {
      await conn.query(prefixed);
      executed += 1;
      rows.push({ file, index, keyword, target, outcome: "OK", text });
    } catch (e) {
      const code = (e && e.code) || "";
      const message = String((e && e.message) || e).slice(0, 200);
      // 与产品 safeExec 逐字同口径：错误码命中 SKIP_ERRORS **或** 消息命中 SKIP_PATTERNS 都算"已知可忽略"
      const shouldSkip = SKIP_ERRORS.has(code) || SKIP_PATTERNS.some((p) => message.toLowerCase().includes(p));
      if (shouldSkip) {
        skipped += 1;
        // 只把"错误码就是 ER_NO_SUCH_TABLE"的算进表不存在计数（与产品日志打码口径一致）
        if (code === "ER_NO_SUCH_TABLE") skipByFile.set(file, (skipByFile.get(file) || 0) + 1);
        rows.push({ file, index, keyword, target, outcome: "SKIP", code, message, text });
      } else {
        errors += 1;
        rows.push({ file, index, keyword, target, outcome: "ERROR", code, message, text });
      }
    }
  }
}
await conn.end();

writeFileSync(outFile, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

console.log(`库 = ${dbName}`);
console.log(`仓库 = ${repo}`);
console.log(`语料文件 = ${files.length}  语句 = ${rows.length}`);
console.log(`执行成功 = ${executed} / 已知可忽略跳过 = ${skipped} / 非忽略错误 = ${errors} / 写闸门挡下 = ${gateBlocked}`);
console.log("-- 重放口径下按文件的 ER_NO_SUCH_TABLE 条数 --");
console.log("文件\t重放条数\t日志条数\t一致?");

const logPerFile = new Map();
if (logFile) {
  for (const line of readFileSync(logFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/\[migration\] (.+?\.sql): 跳过 \(ER_NO_SUCH_TABLE\)/);
    if (m) logPerFile.set(m[1], (logPerFile.get(m[1]) || 0) + 1);
  }
}

let mismatch = 0;
const allFiles = new Set([...skipByFile.keys(), ...logPerFile.keys()]);
for (const f of [...allFiles].sort()) {
  const a = skipByFile.get(f) || 0;
  const b = logPerFile.has(f) ? logPerFile.get(f) : "（无日志）";
  const same = b === "（无日志）" || a === b;
  if (!same) mismatch += 1;
  console.log(`${f}\t${a}\t${b}\t${same ? "一致" : "**MISMATCH**"}`);
}
console.log(mismatch === 0 ? "对账结论：重放与真实运行日志**逐文件一致**" : `对账结论：**不一致 ${mismatch} 个文件**`);
process.exit(mismatch === 0 ? 0 : 1);
