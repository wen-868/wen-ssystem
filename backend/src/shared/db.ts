import mysql from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "./env.js";
import { mockConn, mockQuery } from "./mock-db.js";

export let pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

function splitSqlStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

function findSqlFile(fileName: string) {
  const candidates = [
    resolve(process.cwd(), "../docs", fileName),
    resolve(process.cwd(), "docs", fileName),
    resolve(process.cwd(), "../../docs", fileName),
    join(process.cwd(), fileName)
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`找不到数据库脚本 ${fileName}，已尝试：${candidates.join(", ")}`);
  }
  return found;
}

async function ensureDatabaseExists() {
  const bootstrap = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2
  });
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4`);
  } finally {
    await bootstrap.end();
  }
}

async function tableExists(tableName: string) {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.DB_NAME, tableName]
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function initDatabase() {
  if (env.USE_MOCK_DB) return;
  await ensureDatabaseExists();

  if (await tableExists("sys_user")) {
    console.log("✅ 数据库表已存在，跳过 schema 初始化");
  } else {
    const schemaPath = findSqlFile("phase1_schema.sql");
    const schemaSql = readFileSync(schemaPath, "utf8");
    for (const statement of splitSqlStatements(schemaSql)) {
      await pool.query(statement);
    }
    console.log("✅ 数据库 schema 初始化完成");
  }

  const seedPath = findSqlFile("phase1_seed.sql");
  const seedSql = readFileSync(seedPath, "utf8");
  for (const statement of splitSqlStatements(seedSql)) {
    await pool.query(statement);
  }
  console.log("✅ 数据库种子数据初始化完成");
}

export async function query<T = any>(sql: string, params: unknown[] = []) {
  if (env.USE_MOCK_DB) {
    return mockQuery<T>(sql, params);
  }
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = any>(sql: string, params: unknown[] = []) {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function transaction<T>(runner: (conn: mysql.PoolConnection) => Promise<T>) {
  if (env.USE_MOCK_DB) {
    return runner(mockConn);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await runner(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
