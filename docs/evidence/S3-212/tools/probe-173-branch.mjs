#!/usr/bin/env node
/**
 * S3-212 探针：173 的能力分派在指定版本上会选哪条 DDL（只读，不执行 ALTER）
 * 用法：node probe-173-branch.mjs <port>
 * 输出：@s3212_ver_num / @s3212_pos_instant_ok 与 @s3212_ddl_1..3 的原文
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const port = Number(process.argv[2] ?? 3416);
const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "..", "..", "..", "..", "docs", "migrations", "173_open_platform_api_key_columns.sql");
const text = readFileSync(sqlPath, "utf8");
// 只取能力探测与「选串」用的 SET（纯变量赋值，不含任何 PREPARE/EXECUTE ⇒ 不会执行 ALTER）
const stmts = [...text.matchAll(/SET\s+@s3212_(?:ver_num|pos_instant_ok|ddl_[123])\s*=[\s\S]*?;/g)].map((m) => m[0]);

const conn = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", password: "", multipleStatements: true });
for (const s of stmts) await conn.query(s);
const [rows] = await conn.query(
  "SELECT @@version AS v, @s3212_ver_num AS ver_num, @s3212_pos_instant_ok AS pos_instant_ok, @s3212_ddl_1 AS ddl1, @s3212_ddl_2 AS ddl2, @s3212_ddl_3 AS ddl3"
);
const r = rows[0];
console.log(`port=${port} version=${r.v}`);
console.log(`@s3212_ver_num=${r.ver_num}  @s3212_pos_instant_ok=${r.pos_instant_ok}`);
for (const k of ["ddl1", "ddl2", "ddl3"]) console.log(`@${k} = ${r[k]}`);
await conn.end();
