import mysql from "mysql2/promise";
import { env } from "./env.js";
import { mockConn, mockQuery } from "./mock-db.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

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
