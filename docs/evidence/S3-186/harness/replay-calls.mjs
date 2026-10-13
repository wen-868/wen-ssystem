/**
 * S3-186 装置⑤：把 173 条 CALL **真正执行**一遍——先按 092 原文建两个存储过程，再逐条 CALL。
 * 用途：得到"语料意图全部落地"的基线库（= 修复后空库应达到的结构）。
 *
 * 用法：node docs/evidence/S3-186/harness/replay-calls.mjs <库名> <callsJson> <输出json>
 * 说明：过程定义**从 docs/migrations/092_租户ID.sql 原文抽取**（不手抄），与产品文件同源。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const root = process.env.S3186_REPO_ROOT || process.cwd();
const [, , dbName, callsJson, outJson] = process.argv;
if (!dbName || !callsJson || !outJson) throw new Error("用法: replay-calls.mjs <库名> <callsJson> <输出json>");

const mod = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);
const { calls } = JSON.parse(readFileSync(callsJson, "utf8"));

// 1) 从 092 原文抽取存储过程定义与其配套 DROP
const raw092 = readFileSync(join(root, "docs", "migrations", "092_租户ID.sql"), "utf8");
const cleaned092 = raw092
  .split("\n")
  .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
  .join("\n");
const stmts092 = mod.splitSqlStatements(cleaned092);
const procStatements = stmts092.filter(
  (s) => /^CREATE\b/i.test(mod.stripLeadingComments(s)) && /\bPROCEDURE\b/i.test(s)
);
const dropStatements = stmts092.filter(
  (s) => /^DROP\s+PROCEDURE\b/i.test(mod.stripLeadingComments(s))
);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  multipleStatements: false,
});

const results = [];
const setup = [];
for (const stmt of [...dropStatements, ...procStatements]) {
  try {
    await conn.query(stmt);
    setup.push({ ok: true, kind: mod.firstKeyword(stmt) });
  } catch (e) {
    setup.push({ ok: false, kind: mod.firstKeyword(stmt), code: e.code, message: e.message });
  }
}

let ok = 0;
for (const c of calls) {
  try {
    await conn.query(c.prefixed);
    ok += 1;
    results.push({ file: c.file, target: c.target, status: "OK" });
  } catch (e) {
    results.push({ file: c.file, target: c.target, status: "ERR", code: e.code, message: e.message });
  }
}

const errByCode = {};
for (const r of results) if (r.status === "ERR") errByCode[r.code || "?"] = (errByCode[r.code || "?"] || 0) + 1;

writeFileSync(outJson, JSON.stringify({ db: dbName, setup, total: calls.length, ok, errByCode, results }, null, 1), "utf8");
console.log(`REPLAY db=${dbName} total=${calls.length} 成功=${ok} 报错=${calls.length - ok}`);
console.log("报错码分布：" + (Object.keys(errByCode).length ? Object.entries(errByCode).map(([k, v]) => `${k}=${v}`).join(" ") : "无"));
console.log("过程创建：" + setup.map((s) => `${s.kind}:${s.ok ? "OK" : s.code}`).join(" "));
await conn.end();
