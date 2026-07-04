/**
 * 启动时自动数据库迁移
 *
 * 读取 docs/migrations/ 目录下的 SQL 文件并执行
 * 使用支持 multipleStatements 的独立连接，正确处理 DELIMITER 语法
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import mysql from "mysql2/promise";
import { env } from "./env.js";

export async function runMigrations(): Promise<void> {
  if (env.USE_MOCK_DB) return;

  const migrationsDir = resolve(process.cwd(), "docs/migrations");

  if (!existsSync(migrationsDir)) {
    console.log("[migration] 迁移目录不存在，跳过");
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migration] 无迁移文件，跳过");
    return;
  }

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    connectTimeout: 10000,
  });

  try {
    for (const file of files) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`[migration] 执行: ${file}`);

      try {
        await conn.query(sql);
        console.log(`[migration] ${file} 完成`);
      } catch (e: any) {
        if (
          e.message &&
          (e.message.includes("Duplicate column") ||
            e.message.includes("already exists") ||
            e.message.includes("Duplicate key") ||
            e.code === "ER_DUP_FIELDNAME" ||
            e.code === "ER_DUP_KEYNAME")
        ) {
          console.log(`[migration] ${file} 已执行过，跳过`);
          continue;
        }
        console.error(`[migration] ${file} 失败:`, e.message);
        throw e;
      }
    }
    console.log("[migration] 所有迁移完成");
  } finally {
    await conn.end();
  }
}