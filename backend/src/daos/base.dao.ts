import { query, queryOne, transaction } from "../shared/db.js";
import type { PageParams, PageResult } from "../types/index.js";
import mysql from "mysql2/promise";

export interface BaseDaoOptions {
  tableName: string;
  primaryKey?: string;
  tenantField?: string;
}

export class BaseDAO<T = any> {
  protected tableName: string;
  protected primaryKey: string;
  protected tenantField: string;

  constructor(options: BaseDaoOptions) {
    this.tableName = options.tableName;
    this.primaryKey = options.primaryKey || "id";
    this.tenantField = options.tenantField || "tenant_id";
  }

  async findById(id: number | string, tenantId: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ? AND ${this.tenantField} = ?`;
    return queryOne<T>(sql, [id, tenantId]);
  }

  async findOne(where: Record<string, any>, tenantId: string): Promise<T | null> {
    const { sql, params } = this.buildWhere(where, tenantId);
    const fullSql = `SELECT * FROM ${this.tableName} ${sql} LIMIT 1`;
    return queryOne<T>(fullSql, params);
  }

  async findList(where: Record<string, any> = {}, tenantId: string, orderBy = "id DESC"): Promise<T[]> {
    const { sql, params } = this.buildWhere(where, tenantId);
    const fullSql = `SELECT * FROM ${this.tableName} ${sql} ORDER BY ${orderBy}`;
    return query<T>(fullSql, params);
  }

  async findPage(
    where: Record<string, any> = {},
    pageParams: PageParams,
    tenantId: string,
    orderBy = "id DESC"
  ): Promise<PageResult<T>> {
    const { sql, params } = this.buildWhere(where, tenantId);
    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} ${sql}`;
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = Number(countResult?.total || 0);

    const offset = (pageParams.page - 1) * pageParams.pageSize;
    const dataSql = `SELECT * FROM ${this.tableName} ${sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const records = await query<T>(dataSql, [...params, pageParams.pageSize, offset]);

    return {
      records,
      total,
      page: pageParams.page,
      pageSize: pageParams.pageSize,
    };
  }

  async insert(data: Record<string, any>, tenantId: string): Promise<{ insertId: number; affectedRows: number }> {
    const fields: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      fields.push(key);
      values.push(value);
      placeholders.push("?");
    }

    fields.push(this.tenantField);
    values.push(tenantId);
    placeholders.push("?");

    const sql = `INSERT INTO ${this.tableName} (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const result = await query(sql, values);
    return {
      insertId: (result as any).insertId,
      affectedRows: (result as any).affectedRows || 1,
    };
  }

  async update(id: number | string, data: Record<string, any>, tenantId: string): Promise<number> {
    const sets: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id, tenantId);
    const sql = `UPDATE ${this.tableName} SET ${sets.join(", ")} WHERE ${this.primaryKey} = ? AND ${this.tenantField} = ?`;
    const result = await query(sql, values);
    return (result as any).affectedRows || 0;
  }

  async delete(id: number | string, tenantId: string): Promise<number> {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ? AND ${this.tenantField} = ?`;
    const result = await query(sql, [id, tenantId]);
    return (result as any).affectedRows || 0;
  }

  async count(where: Record<string, any> = {}, tenantId: string): Promise<number> {
    const { sql, params } = this.buildWhere(where, tenantId);
    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} ${sql}`;
    const result = await queryOne<{ total: number }>(countSql, params);
    return Number(result?.total || 0);
  }

  async executeSql(sql: string, params: any[] = []): Promise<any> {
    return query(sql, params);
  }

  async executeTransaction<T>(runner: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
    return transaction(runner);
  }

  protected buildWhere(where: Record<string, any>, tenantId: string): { sql: string; params: any[] } {
    const conditions: string[] = [`${this.tenantField} = ?`];
    const params: any[] = [tenantId];

    for (const [key, value] of Object.entries(where)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "object" && "op" in value) {
        const { op, val } = value as any;
        if (op === "LIKE") {
          conditions.push(`${key} LIKE ?`);
          params.push(`%${val}%`);
        } else if (op === "IN" && Array.isArray(val)) {
          const placeholders = val.map(() => "?").join(", ");
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...val);
        } else if (op === "GT") {
          conditions.push(`${key} > ?`);
          params.push(val);
        } else if (op === "GTE") {
          conditions.push(`${key} >= ?`);
          params.push(val);
        } else if (op === "LT") {
          conditions.push(`${key} < ?`);
          params.push(val);
        } else if (op === "LTE") {
          conditions.push(`${key} <= ?`);
          params.push(val);
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    return {
      sql: `WHERE ${conditions.join(" AND ")}`,
      params,
    };
  }
}
