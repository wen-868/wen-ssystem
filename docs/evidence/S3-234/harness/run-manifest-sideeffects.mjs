#!/usr/bin/env node
/**
 * S3-234 证据装置：按 `deploy/migrations-manifest.txt` 的活动段，逐个文件测「重跑的副作用」与「报错」。
 *
 * 为什么另写装置（而不是只看 `run-migration.mjs` 的 exit 0）：
 *   `scripts/run-migration.mjs` 把整份文件当**一条多语句查询**下发，只打印最后一条 SELECT 的结果 ⇒
 *   ① 语句级 affectedRows 被丢掉，"第二遍零变更"在那份输出里**没有原始读数可核**；
 *   ② 它的 `exit 0` 还包含「Duplicate column / already exists ⇒ 视为已应用」这条宽容分支
 *      ⇒ "退出码 0"不等于"这次真的没动数据"。
 *   本装置用同一份文件、同一台库、同样的 multipleStatements 通道，把**每个文件**的
 *   受影响行数合计 + 结构面增量（表 / 裸表 / 列 / 索引 / 外键）逐条打出来，作为
 *   「已应用重复跑零副作用」的机读判据（判据：第二遍 affected 合计 = 0 且五个增量全 0）。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --pass=1
 *   node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --pass=2 --json-out=<文件>
 *   node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --files=a.sql,b.sql   # 只跑指定文件
 *   node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --manifest=<相对路径>
 * 连接参数取环境变量（默认 = 本机夹具库，**空口令**，本装置不打印任何连接凭据）：
 *   DB_HOST/DB_PORT/DB_USER/DB_NAME
 *
 * 边界（诚实标注）：本装置只证明**迁移 SQL 自身的幂等与副作用面**，不替代生产执行与只读复核；
 *   生产执行仍须由凌舟走官方通道（`node scripts/run-migration.mjs <file>`，或部署段）。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(process.cwd());
const require = createRequire(path.join(repoRoot, "package.json"));
const mysql = require("mysql2/promise");

const argv = process.argv.slice(2);
const argValue = (flag) => {
  const withEq = argv.find((a) => a.startsWith(`${flag}=`));
  if (withEq) return withEq.slice(flag.length + 1);
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] ?? null : null;
};

const pass = argValue("--pass") ?? "?";
const manifestRel = argValue("--manifest") ?? "deploy/migrations-manifest.txt";
const jsonOut = argValue("--json-out");
const onlyFiles = (argValue("--files") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DB = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3409),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "liquor_inventory",
  multipleStatements: true,
  connectTimeout: 10000,
};

// ---- 清单解析（与 backend/scripts/guard-migration-manifest.mjs 同口径：跳过空行与 # 行）----
const manifestAbs = path.join(repoRoot, manifestRel);
const active = fs
  .readFileSync(manifestAbs, "utf-8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#") && l.endsWith(".sql"))
  .filter((l) => (onlyFiles.length ? onlyFiles.includes(l) : true));

const migrationsDir = path.join(repoRoot, "docs", "migrations");

// ---- 结构面快照（表 / 裸表 / 列 / 索引 / 外键）----
async function snapshot(conn) {
  const one = async (sql) => {
    const [rows] = await conn.query(sql);
    return Number(Object.values(rows[0])[0]);
  };
  const db = DB.database;
  return {
    tables: await one(
      `SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}' AND TABLE_TYPE='BASE TABLE'`,
    ),
    bareTables: await one(
      `SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}' AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME NOT LIKE 't\\_%'`,
    ),
    columns: await one(`SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}'`),
    indexes: await one(
      `SELECT COUNT(DISTINCT TABLE_NAME, INDEX_NAME) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${db}'`,
    ),
    fks: await one(
      `SELECT COUNT(*) c FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${db}'`,
    ),
  };
}

/**
 * 与 scripts/run-migration.mjs 同口径执行一个文件：
 *   · 整份文件一条 multipleStatements 查询下发（MySQL 在**第一条出错处**中止，其后语句不执行）；
 *   · 报错信息含 "Duplicate column" / "already exists" ⇒ 记为 skip（run-migration.mjs 视为已应用、exit 0）；
 *   · 其余报错 ⇒ 记为 fail（run-migration.mjs exit 1）。
 */
async function runFile(file) {
  const abs = path.join(migrationsDir, file);
  const sql = fs.readFileSync(abs, "utf-8");
  const conn = await mysql.createConnection(DB);
  const started = Date.now();
  try {
    const before = await snapshot(conn);
    let affectedSum = 0;
    let changedSum = 0;
    let writeStatements = 0;
    let selectStatements = 0;
    let outcome = "ok";
    let reason = "";
    try {
      const [results] = await conn.query(sql);
      const sets = Array.isArray(results) ? results : [results];
      sets.forEach((set) => {
        if (Array.isArray(set)) {
          selectStatements++;
          return;
        }
        if (set && typeof set === "object") {
          writeStatements++;
          affectedSum += Number(set.affectedRows ?? 0);
          changedSum += Number(set.changedRows ?? 0);
        }
      });
    } catch (e) {
      const msg = String(e?.message ?? e);
      reason = `${e?.code ?? ""} errno=${e?.errno ?? "-"} ${msg}`.trim();
      outcome = /Duplicate column|already exists/i.test(msg) ? "skip" : "fail";
    }
    const after = await snapshot(conn);
    const delta = {};
    for (const k of Object.keys(before)) delta[k] = after[k] - before[k];
    return {
      file,
      outcome,
      reason,
      affectedSum,
      changedSum,
      writeStatements,
      selectStatements,
      delta,
      sideEffect: affectedSum > 0 || Object.values(delta).some((v) => v !== 0),
      ms: Date.now() - started,
    };
  } finally {
    await conn.end();
  }
}

const records = [];
for (let i = 0; i < active.length; i++) {
  const file = active[i];
  const rec = await runFile(file);
  records.push(rec);
  const d = rec.delta;
  const deltaText = `Δtables=${d.tables} Δbare=${d.bareTables} Δcols=${d.columns} Δidx=${d.indexes} Δfk=${d.fks}`;
  console.log(
    `[${i + 1}/${active.length}] ${file} | ${rec.outcome} | affected=${rec.affectedSum} changed=${rec.changedSum} | ${deltaText} | ${rec.ms}ms` +
      (rec.reason ? ` | ${rec.reason}` : ""),
  );
}

const summary = {
  pass,
  manifest: manifestRel,
  database: `${DB.database}@${DB.host}:${DB.port}`,
  files: active.length,
  ok: records.filter((r) => r.outcome === "ok").length,
  skip: records.filter((r) => r.outcome === "skip").length,
  fail: records.filter((r) => r.outcome === "fail").length,
  withSideEffect: records.filter((r) => r.sideEffect).map((r) => r.file),
  affectedTotal: records.reduce((s, r) => s + r.affectedSum, 0),
  failed: records.filter((r) => r.outcome === "fail").map((r) => `${r.file} :: ${r.reason}`),
  records,
};

console.log("");
console.log(
  `汇总(pass=${pass})：文件 ${summary.files}｜ok ${summary.ok} / skip ${summary.skip} / fail ${summary.fail}｜` +
    `受影响行数合计 ${summary.affectedTotal}｜有副作用文件 ${summary.withSideEffect.length}`,
);
if (summary.withSideEffect.length) {
  console.log(`⚠️ 本遍仍有副作用的文件：${summary.withSideEffect.join(" | ")}`);
}
if (summary.failed.length) {
  console.log(`⚠️ 本遍失败的文件（${summary.failed.length}）：`);
  for (const f of summary.failed) console.log(`   - ${f}`);
}

if (jsonOut) {
  fs.writeFileSync(path.resolve(repoRoot, jsonOut), JSON.stringify(summary, null, 2), "utf-8");
  console.log(`（机读结果已落盘：${jsonOut}）`);
}
