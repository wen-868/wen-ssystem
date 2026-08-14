export * from "../config/database";

import type mysql from "mysql2/promise";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * 在事务中执行 SQL（替代 `(conn as any).execute`）。
 *
 * 类型签名与 queryWithTenant 对齐，但接收外部传入的 conn。
 * mysql2 的 PoolConnection.execute 已有完整重载签名，本函数仅做类型转换层，
 * 消除 `(conn as any).execute` 中的 any 逃逸。
 *
 * 注意：
 * 1. PoolConnection 类型必须从 `mysql2/promise` 导入（与 database.ts 的 transaction
 *    回调参数类型一致），从 `mysql2` 导入的 PoolConnection 是 callback 风格，两者不兼容。
 * 2. mysql2 的 execute 方法对 values 参数类型要求严格（ExecuteValues 递归联合类型），
 *    而 queryWithTenant 等对外接口用 unknown[]（与 QueryValues 兼容）。这里用 `as never`
 *    在内部绕过 ExecuteValues 的严格约束，不引入 any，对外保持 unknown[] 接口。
 *
 * 用法：
 *   const [rows] = await connExecute<XxxRow[]>(conn, "SELECT ...", [param]);
 *   const [result] = await connExecute<ResultSetHeader>(conn, "INSERT ...", [param]);
 */
export async function connExecute<T extends RowDataPacket[] | ResultSetHeader>(
  conn: mysql.PoolConnection,
  sql: string,
  params: unknown[] = []
): Promise<[T, unknown]> {
  return (await conn.execute(sql, params as never)) as [T, unknown];
}

/**
 * 在事务中查询多行（替代 `const [rows] = await (conn as any).execute(...)`）。
 *
 * 用法：
 *   const rows = await connQuery<XxxRow[]>(conn, "SELECT ...", [param]);
 */
export async function connQuery<T extends RowDataPacket[]>(
  conn: mysql.PoolConnection,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const [rows] = await conn.execute(sql, params as never);
  return rows as T;
}

/**
 * 在事务中查询单行（替代 `const [rows] = await (conn as any).execute(...); const x = rows[0]`）。
 *
 * 用法：
 *   const row = await connQueryOne<XxxRow>(conn, "SELECT ... WHERE id = ?", [id]);
 */
export async function connQueryOne<T extends RowDataPacket>(
  conn: mysql.PoolConnection,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const [rows] = await conn.execute(sql, params as never);
  const list = rows as T[];
  return list[0] ?? null;
}
