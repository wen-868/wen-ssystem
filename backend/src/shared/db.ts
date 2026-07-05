import mysql from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import logger from "./logger.js";
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
    logger.info("✅ 数据库表已存在，跳过 schema 初始化");
  } else {
    const schemaPath = findSqlFile("phase1_schema.sql");
    const schemaSql = readFileSync(schemaPath, "utf8");
    for (const statement of splitSqlStatements(schemaSql)) {
      await pool.query(statement);
    }
    logger.info("✅ 数据库 schema 初始化完成");
  }

  const seedPath = findSqlFile("phase1_seed.sql");
  const seedSql = readFileSync(seedPath, "utf8");
  for (const statement of splitSqlStatements(seedSql)) {
    await pool.query(statement);
  }
  logger.info("✅ 数据库种子数据初始化完成");
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

/**
 * 带租户隔离的查询函数
 * 自动在 SQL 中注入 tenant_id 过滤条件
 * 
 * @param sql - SQL 语句
 * @param params - 参数数组
 * @param tenantId - 租户ID
 * @returns 查询结果
 */
export async function queryWithTenant<T = any>(sql: string, params: unknown[] = [], tenantId: string): Promise<T[]> {
  if (env.USE_MOCK_DB) {
    // 在 mock 模式下也验证 SQL 是否包含 tenant_id 条件，防止生产环境跨租户数据泄露
    const lowerSql = sql.toLowerCase();
    const hasTenantId = lowerSql.includes('tenant_id');
    if (!hasTenantId) {
      console.warn(`[mock-db] WARNING: queryWithTenant 调用缺少 tenant_id 条件: ${sql.substring(0, 100)}`);
    }
    const result = await mockQuery<T>(sql, params);
    // 对结果进行租户过滤（模拟生产环境的租户隔离）
    if (Array.isArray(result) && result.length > 0) {
      const firstRow = result[0] as any;
      if (firstRow && typeof firstRow === 'object') {
        const tenantKey = 'tenant_id' in firstRow ? 'tenant_id' : ('tenantId' in firstRow ? 'tenantId' : null);
        if (tenantKey) {
          return result.filter((row: any) => row[tenantKey] === tenantId) as T[];
        }
      }
    }
    return result;
  }
  
  const { modifiedSql, modifiedParams } = injectTenantCondition(sql, params, tenantId);
  const [rows] = await pool.query(modifiedSql, modifiedParams);
  return rows as T[];
}

/**
 * 带租户隔离的单条查询函数
 * 
 * @param sql - SQL 语句
 * @param params - 参数数组
 * @param tenantId - 租户ID
 * @returns 单条记录或 null
 */
export async function queryOneWithTenant<T = any>(sql: string, params: unknown[] = [], tenantId: string): Promise<T | null> {
  const rows = await queryWithTenant<T>(sql, params, tenantId);
  return rows[0] ?? null;
}

export async function executeWithTenant(sql: string, params: unknown[] = [], tenantId: string): Promise<void> {
  await queryWithTenant(sql, params, tenantId);
}

/**
 * 解析 SQL 并注入 tenant_id 条件
 */
function injectTenantCondition(sql: string, params: unknown[], tenantId: string): { modifiedSql: string; modifiedParams: unknown[] } {
  const trimmedSql = sql.trim().toUpperCase();
  
  // 判断 SQL 类型
  if (trimmedSql.startsWith('SELECT')) {
    return injectSelectTenant(sql, params, tenantId);
  } else if (trimmedSql.startsWith('INSERT')) {
    return injectInsertTenant(sql, params, tenantId);
  } else if (trimmedSql.startsWith('UPDATE')) {
    return injectUpdateTenant(sql, params, tenantId);
  } else if (trimmedSql.startsWith('DELETE')) {
    return injectDeleteTenant(sql, params, tenantId);
  }
  
  // 未知类型，不修改
  return { modifiedSql: sql, modifiedParams: params };
}

/**
 * 处理 SELECT 语句
 */
function injectSelectTenant(sql: string, params: unknown[], tenantId: string): { modifiedSql: string; modifiedParams: unknown[] } {
  // 检查是否已经有 tenant_id 条件
  if (sql.toLowerCase().includes('tenant_id')) {
    return { modifiedSql: sql, modifiedParams: params };
  }
  
  // 在 WHERE 子句中添加 tenant_id 条件
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('where')) {
    const insertIndex = lowerSql.indexOf('where') + 5;
    const modifiedSql = sql.substring(0, insertIndex) + ` tenant_id = ? AND ` + sql.substring(insertIndex);
    return { modifiedSql, modifiedParams: [tenantId, ...params] };
  } else {
    const modifiedSql = sql + ' WHERE tenant_id = ?';
    return { modifiedSql, modifiedParams: [...params, tenantId] };
  }
}

/**
 * 处理 INSERT 语句
 */
function injectInsertTenant(sql: string, params: unknown[], tenantId: string): { modifiedSql: string; modifiedParams: unknown[] } {
  // 检查是否已经有 tenant_id 字段
  if (sql.toLowerCase().includes('tenant_id')) {
    return { modifiedSql: sql, modifiedParams: params };
  }
  
  // 在字段列表和值列表中插入 tenant_id
  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(\s*([^)]+)\s*\)\s*VALUES\s*\(\s*([^)]+)\s*\)/i);
  if (insertMatch) {
    const [, tableName, fields, values] = insertMatch;
    const modifiedSql = `INSERT INTO ${tableName} (tenant_id, ${fields}) VALUES (?, ${values})`;
    return { modifiedSql, modifiedParams: [tenantId, ...params] };
  }
  
  return { modifiedSql: sql, modifiedParams: params };
}

/**
 * 处理 UPDATE 语句
 */
function injectUpdateTenant(sql: string, params: unknown[], tenantId: string): { modifiedSql: string; modifiedParams: unknown[] } {
  // 检查是否已经有 tenant_id 条件
  if (sql.toLowerCase().includes('tenant_id')) {
    return { modifiedSql: sql, modifiedParams: params };
  }
  
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes('where')) {
    const insertIndex = lowerSql.indexOf('where') + 5;
    const modifiedSql = sql.substring(0, insertIndex) + ` tenant_id = ? AND ` + sql.substring(insertIndex);
    return { modifiedSql, modifiedParams: [tenantId, ...params] };
  } else {
    const modifiedSql = sql + ' WHERE tenant_id = ?';
    return { modifiedSql, modifiedParams: [...params, tenantId] };
  }
}

/**
 * 处理 DELETE 语句
 */
function injectDeleteTenant(sql: string, params: unknown[], tenantId: string): { modifiedSql: string; modifiedParams: unknown[] } {
  return injectUpdateTenant(sql, params, tenantId);
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
