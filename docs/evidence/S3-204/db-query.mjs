/**
 * S3-204 证据脚本：本机 MySQL 只读查询跑手
 *
 * 用途：把 SQL 打到本机库（默认 liquor_inventory），以 JSON 原样打印结果，
 *       供 §一「现有资产盘点」与 §四「交叉核对」取证使用。
 *
 * 运行：node docs/evidence/S3-204/db-query.mjs "<SQL>"      # 打印 JSON
 *       node docs/evidence/S3-204/db-query.mjs --file <sql 文件>
 *
 * 连接参数与 backend/src/config/env.ts 默认值一致，可用 DB_* 环境变量覆盖。
 * 只读约束：本脚本拒绝任何非 SELECT/SHOW/DESCRIBE/EXPLAIN 开头的语句。
 */
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const argv = process.argv.slice(2);
const isFile = argv[0] === "--file";
const sql = (isFile ? readFileSync(argv[1], "utf8") : argv[0] || "").trim();

if (!/^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(sql)) {
  console.error("[db-query] 只允许只读语句（SELECT/SHOW/DESCRIBE/EXPLAIN/WITH）");
  process.exit(2);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "zhixiang_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "liquor_inventory",
  multipleStatements: true,
});

try {
  const [rows] = await conn.query(sql);
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await conn.end();
}
