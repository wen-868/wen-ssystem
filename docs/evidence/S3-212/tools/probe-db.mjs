#!/usr/bin/env node
/**
 * S3-212 生产/真库连通性探针（只读）
 * 用法：node probe-db.mjs <envFile> [envFile2 ...]
 * 只打印 host/port/user/db + 连接结果；口令不落屏。
 * 连接成功后只执行只读语句（SELECT / information_schema）。
 */
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("用法: node probe-db.mjs <envFile> [...]");
  process.exit(2);
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    out[m[1]] = v;
  }
  return out;
}

for (const f of files) {
  let env;
  try {
    env = parseEnv(readFileSync(f, "utf8"));
  } catch (e) {
    console.log(`[跳过] ${f} 读取失败：${e.code}`);
    continue;
  }
  const host = env.DB_HOST ?? env.MYSQL_HOST ?? "";
  const port = Number(env.DB_PORT ?? env.MYSQL_PORT ?? 3306);
  const user = env.DB_USER ?? env.MYSQL_USER ?? "";
  const pwd = env.DB_PASSWORD ?? env.MYSQL_PASSWORD ?? "";
  const db = env.DB_NAME ?? env.MYSQL_DATABASE ?? "";
  console.log(`\n=== ${f}`);
  console.log(`host=${host} port=${port} user=${user} db=${db} 口令长度=${pwd.length}`);
  if (!host || !user) {
    console.log("结果：配置不完整，跳过连接");
    continue;
  }
  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password: pwd, database: db || undefined, connectTimeout: 8000 });
    const [v] = await conn.query("SELECT VERSION() AS v, @@hostname AS h");
    console.log(`结果：连接成功 version=${v[0].v} hostname=${v[0].h}`);
    if (db) {
      const [t] = await conn.query(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ?",
        [db]
      );
      console.log(`information_schema.tables(${db}) = ${t[0].c}`);
    }
  } catch (e) {
    console.log(`结果：连接/查询失败 ${e.code ?? ""} ${String(e.message ?? e).slice(0, 200)}`);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
