/**
 * S3-149 空库表齐 + 形状核对（真空白库，只跑 runMigrations()）
 * 用法（cwd = scratch 根）：
 *   S3149_CHECK_DB=<dbname> node docs/evidence/S3-149/check-tables.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

const db = process.env.S3149_CHECK_DB || process.env.DB_NAME;
const pool = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: db,
});

// 声明表清单：与 migration.ts 第 1.5 步同源（splitSqlStatements + CREATE TABLE 过滤）
const { splitSqlStatements } = await import(
  new URL("../../../backend/dist/shared/migration.js", import.meta.url).href
);
const sql = readFileSync(join(process.cwd(), "docs", "init_database.sql"), "utf8");
const declared = splitSqlStatements(sql)
  .filter((s) => /^CREATE\s+TABLE\b/i.test(s))
  .map((s) => /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i.exec(s)?.[1])
  .filter(Boolean);

const [rows] = await pool.query(
  "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
);
const present = new Set(rows.map((r) => r.TABLE_NAME));
const missing = declared.filter((t) => !present.has(t));

console.log(`DB=${db}`);
console.log(`DECLARED_TABLES=${declared.length}`);
console.log(`PRESENT_IN_DB=${present.size}`);
console.log(`MISSING_DECLARED=${missing.length}` + (missing.length ? ` -> ${missing.join(",")}` : ""));
console.log("---- 逐表核对（init_database.sql 声明的每一张表） ----");
let idx = 0;
for (const t of declared) {
  idx += 1;
  console.log(`${String(idx).padStart(2, "0")} ${present.has(t) ? "EXISTS " : "MISSING"} ${t}`);
}

// t_store 形状核对（对照生产读数）
const [cols] = await pool.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
     FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_store'
      AND COLUMN_NAME IN ('tenant_id','status','business_status')
    ORDER BY ORDINAL_POSITION`
);
for (const c of cols) {
  console.log(`t_store.${c.COLUMN_NAME} | ${c.COLUMN_TYPE} | nullable=${c.IS_NULLABLE} | default=${c.COLUMN_DEFAULT === null ? "NULL" : c.COLUMN_DEFAULT} | key=${c.COLUMN_KEY}`);
}
const [idx2] = await pool.query(
  `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, NON_UNIQUE
     FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_store'
    GROUP BY INDEX_NAME, NON_UNIQUE ORDER BY INDEX_NAME`
);
for (const i of idx2) console.log(`t_store.index ${i.INDEX_NAME} (${i.cols}) unique=${i.NON_UNIQUE === 0}`);
const [cfg] = await pool.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sys_config' ORDER BY ORDINAL_POSITION`
);
console.log(`t_sys_config_EXISTS=${present.has("t_sys_config")}`);
console.log(`t_sys_config_COLUMNS=${cfg.map((c) => `${c.COLUMN_NAME}:${c.COLUMN_TYPE}`).join(",")}`);
await pool.end();
process.exit(missing.length === 0 ? 0 : 1);
