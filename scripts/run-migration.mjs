#!/usr/bin/env node
/**
 * 数据库迁移执行脚本
 * 使用后端自己的数据库连接配置，不依赖外部 mysql CLI
 *
 * 用法: node scripts/run-migration.mjs <sql-file>
 * 示例: node scripts/run-migration.mjs docs/migrations/add_tenant_id.sql
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";

// 加载 .env 文件
const envPath = resolve(process.cwd(), ".env");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  env[key] = value;
}

const DB_HOST = env.DB_HOST || "127.0.0.1";
const DB_PORT = parseInt(env.DB_PORT || "3306", 10);
const DB_USER = env.DB_USER || "root";
const DB_PASSWORD = env.DB_PASSWORD || "";
const DB_NAME = env.DB_NAME || "liquor_inventory";

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("用法: node scripts/run-migration.mjs <sql-file>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), sqlFile);
let sqlContent;
try {
  sqlContent = readFileSync(sqlPath, "utf-8");
} catch (e) {
  console.error(`无法读取 SQL 文件: ${sqlPath}`);
  process.exit(1);
}

async function run() {
  let conn;
  try {
    // 先连接（不指定数据库），处理 USE 语句
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true,
      connectTimeout: 10000,
    });

    console.log(`已连接数据库 ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    console.log(`执行迁移: ${sqlFile}`);

    const [results] = await conn.query(sqlContent);

    // 检查最后一个结果是否是 SELECT（迁移完成标志）
    if (Array.isArray(results) && results.length > 0) {
      const lastResult = results[results.length - 1];
      if (Array.isArray(lastResult) && lastResult.length > 0) {
        console.log(lastResult[0].result || "迁移完成");
      }
    }

    console.log("迁移执行成功");
    process.exit(0);
  } catch (e) {
    // 如果错误是 "Duplicate column" 或 "already exists"，说明已经迁移过了
    if (e.message && (e.message.includes("Duplicate column") || e.message.includes("already exists"))) {
      console.log("迁移已执行过（列已存在），跳过");
      process.exit(0);
    }
    console.error("迁移失败:", e.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();