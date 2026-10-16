#!/usr/bin/env node
/**
 * S3-234 证据装置：夹具库只读读数（连接参数走环境变量，默认本机夹具库，**不打印任何口令**）。
 *
 * 用途：每一步取证前后各跑一次，把"结构面/结果态"的**原始读数**落进证据文件，
 *   避免用"我看过了"代替可核对数字（判据必须能被别人复跑）。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/db-probe.mjs
 *   node docs/evidence/S3-234/harness/db-probe.mjs --out docs/evidence/S3-234/raw/xx.txt
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(process.cwd());
const mysql = createRequire(path.join(repoRoot, "package.json"))("mysql2/promise");

const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;

const DB = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3409),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "liquor_inventory",
};

const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const conn = await mysql.createConnection({ ...DB, connectTimeout: 10000 });
const q = async (sql) => {
  const [rows] = await conn.query(sql);
  return rows;
};
const one = async (sql) => Object.values((await q(sql))[0])[0];
const D = DB.database;

say(`== 夹具库读数 ${new Date().toISOString()}（db=${D}@${DB.host}:${DB.port}，口令由环境提供，不打印）`);
say(`server_version            = ${await one("SELECT VERSION() v")}`);
say(`base_tables               = ${await one(`SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA='${D}' AND TABLE_TYPE='BASE TABLE'`)}`);
say(`columns                   = ${await one(`SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${D}'`)}`);
say(`indexes(distinct T/I)     = ${await one(`SELECT COUNT(DISTINCT TABLE_NAME, INDEX_NAME) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${D}'`)}`);
say(`foreign_keys              = ${await one(`SELECT COUNT(*) c FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${D}'`)}`);
say("-- 069 结果态（列 / 外键 / 索引 三读数）--");
say(`c069_brand_id_col         = ${await one(`SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${D}' AND TABLE_NAME='t_product_spu' AND COLUMN_NAME='brand_id'`)}`);
say(`c069_fk                   = ${await one(`SELECT COUNT(*) c FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${D}' AND TABLE_NAME='t_product_spu' AND CONSTRAINT_NAME='fk_product_spu_brand'`)}`);
say(`c069_idx                  = ${await one(`SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${D}' AND TABLE_NAME='t_product_spu' AND INDEX_NAME='idx_product_spu_brand_id'`)}`);
say("-- 204 结果态（系统设置域权限点，抽查两条）--");
say(`t_sys_role rows           = ${await one(`SELECT COUNT(*) c FROM t_sys_role`)}`);
say(`t_sys_menu rows          = ${await one(`SELECT COUNT(*) c FROM t_sys_menu`)}`);
say(`t_sys_role columns       = ${await one(`SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${D}' AND TABLE_NAME='t_sys_role'`)}`);

await conn.end();

if (outFile) {
  const abs = path.resolve(repoRoot, outFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, lines.join("\n") + "\n", "utf-8");
  console.log(`（读数已落盘：${outFile}）`);
}
