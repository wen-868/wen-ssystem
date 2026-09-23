/**
 * S3-80 B-2 核验探针 —— `backend/src/shared/db` 的 SQLite 替身
 *
 * 目的：让**未改一行的真实产品代码**（`backend/src/services/sync/delta-sync.service.ts`
 * 的 `submitOfflineOrders`）跑在一个**真实 SQL 引擎**上，从而得到"同幂等键提交两次是否只落一单"
 * 的**引擎级**证据（含 UNIQUE 约束、事务回滚、默认值），而不是手搓内存对象。
 *
 * 与生产 `backend/src/config/database.ts` 的语义对齐点（逐条）：
 *  1. `queryWithTenant` / `queryOneWithTenant`：先按 SQL 首关键字做租户条件注入，再执行；
 *     注入规则逐字搬运 `injectSelectTenant` / `injectInsertTenant` / `injectUpdateTenant`（database.ts:203-283）。
 *     ——本探针覆盖的 SQL 全部自带 tenant_id，注入实际不发生（探针会把"发生注入"记为告警）。
 *  2. 写语句经 `queryWithTenant` 时返回**归一化为数组**的首元素（database.ts:161 的 R70-24 归一化）。
 *  3. `transaction(fn)`：BEGIN → 以 `conn` 执行 → COMMIT；抛错则 ROLLBACK 并向上抛出（database.ts:288-307）。
 *     `conn.query` 在生产被 `addTablePrefix` 包一层、`conn.execute` 不被包；
 *     本探针不改 SQL（被测语句本身已带 `t_` 前缀，可在 SQL 日志里逐条核对），故该差异不影响结论。
 *
 * 与生产**不同**、必须声明的证据边界（详见同目录 README.md）：
 *  - 引擎由 MySQL(InnoDB) 换成 SQLite：隔离级别/锁粒度不同 ⇒ "并发"场景只能证明"先查后插窗口存在且被唯一键挡住"，
 *    不能替代真库并发压测；
 *  - 唯一键冲突报错文本按 MySQL 口径归一化（code=ER_DUP_ENTRY, errno=1062），仅为让 errorMsg 可比对；
 *  - DECIMAL 在 SQLite 下按 NUMERIC 存，不保 2 位小数格式。
 */
import { DatabaseSync } from "node:sqlite";
import { DDL } from "./schema-sqlite.mjs";

export const sqlLog = [];
export const tenantInjectionLog = [];

const db = new DatabaseSync(":memory:");
db.exec(DDL);

function firstKeyword(sql) {
  const s = sql.trim().toLowerCase();
  for (const kw of ["select", "insert", "update", "delete", "replace"]) {
    if (s.startsWith(kw)) return kw;
  }
  return "other";
}

/** 表名 / 列名抽取，仅用于"写入域清单"证据（不做完整 SQL 解析） */
function describe(sql) {
  const op = firstKeyword(sql);
  const flat = sql.replace(/\s+/g, " ").trim();
  let table = null;
  const ins = flat.match(/insert\s+into\s+([`"]?)(\w+)\1/i);
  const upd = flat.match(/update\s+([`"]?)(\w+)\1/i);
  const del = flat.match(/delete\s+from\s+([`"]?)(\w+)\1/i);
  const from = flat.match(/from\s+([`"]?)(\w+)\1/i);
  table = ins?.[2] ?? upd?.[2] ?? del?.[2] ?? from?.[2] ?? null;
  let columns = [];
  if (op === "insert") {
    const m = flat.match(/insert\s+into\s+[`"]?\w+[`"]?\s*\(([^)]+)\)/i);
    if (m) columns = m[1].split(",").map((c) => c.trim().replace(/[`"]/g, ""));
  }
  return { op, table, columns };
}

function log(sql) {
  sqlLog.push({ ...describe(sql), sql: sql.replace(/\s+/g, " ").trim() });
}

function isWrite(op) {
  return op === "insert" || op === "update" || op === "delete";
}

/** MySQL 口径的唯一键冲突错误（便于与真库 errorMsg 对齐） */
function normalizeError(err, params) {
  const msg = String(err?.message ?? err);
  if (/UNIQUE constraint failed/i.test(msg)) {
    const col = msg.split("UNIQUE constraint failed:")[1]?.trim() ?? "unknown";
    const e = new Error(`Duplicate entry '${params?.[0] ?? ""}' for key '${col.replace(/\s+/g, "")}'`);
    e.code = "ER_DUP_ENTRY";
    e.errno = 1062;
    return e;
  }
  return err;
}

function rawRun(sql, params) {
  log(sql);
  const op = firstKeyword(sql);
  const stmt = db.prepare(sql);
  try {
    if (op === "select") {
      return { rows: stmt.all(...(params ?? [])), header: null };
    }
    const r = stmt.run(...(params ?? []));
    return {
      rows: [],
      header: { affectedRows: Number(r.changes), insertId: Number(r.lastInsertRowid) },
    };
  } catch (err) {
    throw normalizeError(err, params);
  }
}

// ==================== 租户条件注入（逐字对齐 config/database.ts） ====================

function injectSelectTenant(sql, params, tenantId) {
  if (sql.toLowerCase().includes("tenant_id")) return { modifiedSql: sql, modifiedParams: params };
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes("where")) {
    const insertIndex = lowerSql.indexOf("where") + 5;
    return {
      modifiedSql: sql.substring(0, insertIndex) + ` tenant_id = ? AND ` + sql.substring(insertIndex),
      modifiedParams: [tenantId, ...params],
    };
  }
  return { modifiedSql: sql + " WHERE tenant_id = ?", modifiedParams: [...params, tenantId] };
}

function injectInsertTenant(sql, params, tenantId) {
  if (sql.toLowerCase().includes("tenant_id")) return { modifiedSql: sql, modifiedParams: params };
  const m = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(\s*([^)]+)\s*\)\s*VALUES\s*\(\s*([^)]+)\s*\)/i);
  if (m) {
    const [, tableName, fields, values] = m;
    return {
      modifiedSql: `INSERT INTO ${tableName} (tenant_id, ${fields}) VALUES (?, ${values})`,
      modifiedParams: [tenantId, ...params],
    };
  }
  return { modifiedSql: sql, modifiedParams: params };
}

function injectUpdateTenant(sql, params, tenantId) {
  if (sql.toLowerCase().includes("tenant_id")) return { modifiedSql: sql, modifiedParams: params };
  const lowerSql = sql.toLowerCase();
  if (lowerSql.includes("where")) {
    const insertIndex = lowerSql.indexOf("where") + 5;
    const placeholdersBeforeWhere = (sql.substring(0, insertIndex).match(/\?/g) || []).length;
    return {
      modifiedSql: sql.substring(0, insertIndex) + ` tenant_id = ? AND ` + sql.substring(insertIndex),
      modifiedParams: [
        ...params.slice(0, placeholdersBeforeWhere),
        tenantId,
        ...params.slice(placeholdersBeforeWhere),
      ],
    };
  }
  return { modifiedSql: sql + " WHERE tenant_id = ?", modifiedParams: [...params, tenantId] };
}

function injectTenantCondition(sql, params, tenantId) {
  const op = firstKeyword(sql);
  const r =
    op === "select" ? injectSelectTenant(sql, params, tenantId)
      : op === "insert" ? injectInsertTenant(sql, params, tenantId)
        : op === "update" || op === "delete" ? injectUpdateTenant(sql, params, tenantId)
          : { modifiedSql: sql, modifiedParams: params };
  if (r.modifiedSql !== sql) {
    tenantInjectionLog.push({ tenantId, before: sql.replace(/\s+/g, " ").trim(), after: r.modifiedSql.replace(/\s+/g, " ").trim() });
  }
  return r;
}

// ==================== 对外接口（与 shared/db 同名同参） ====================

export async function query(sql, params = []) {
  const { rows, header } = rawRun(sql, params);
  return header ? [header] : rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function queryWithTenant(sql, params = [], tenantId) {
  const { modifiedSql, modifiedParams } = injectTenantCondition(sql, params, tenantId);
  const { rows, header } = rawRun(modifiedSql, modifiedParams);
  return header ? [header] : rows;
}

export async function queryOneWithTenant(sql, params = [], tenantId) {
  const rows = await queryWithTenant(sql, params, tenantId);
  return rows[0] ?? null;
}

export async function executeWithTenant(sql, params = [], tenantId) {
  await queryWithTenant(sql, params, tenantId);
}

let txDepth = 0;

/**
 * 事务：与生产同构（BEGIN → 回调 → COMMIT / 出错 ROLLBACK）。
 *
 * 额外说明（证据边界）：生产是连接池里的**独立连接**，因此"两个请求同时在事务中"是合法的。
 * SQLite 单连接不允许嵌套 BEGIN，故这里对**嵌套调用**退化为 SAVEPOINT —— 只是为了让
 * "并发/交错"场景能跑下去，**不代表 MySQL 的隔离语义**；并发结论以 S5（唯一键兜底）为准。
 */
export async function transaction(runner) {
  const outer = txDepth === 0;
  const sp = `sp_${txDepth}`;
  db.exec(outer ? "BEGIN" : `SAVEPOINT ${sp}`);
  txDepth++;
  const conn = {
    query: async (sql, params = []) => {
      const { rows, header } = rawRun(sql, params);
      return [header ?? rows, undefined];
    },
    execute: async (sql, params = []) => {
      const { rows, header } = rawRun(sql, params);
      return [header ?? rows, undefined];
    },
  };
  try {
    const result = await runner(conn);
    txDepth--;
    db.exec(txDepth === 0 ? "COMMIT" : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    txDepth--;
    db.exec(txDepth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw err;
  }
}

/** 探针专用：直接读库（不经过被测代码），用于断言"到底落了几行" */
export function probeQuery(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** 探针专用：直接写库（仅用于铺夹具，如客户数据） */
export function probeRun(sql, params = []) {
  return db.prepare(sql).run(...params);
}

export function resetLogs() {
  sqlLog.length = 0;
  tenantInjectionLog.length = 0;
}

/**
 * 【B-2b 新增】生产 `shared/db` 的 `pool` 导出替身。
 * 只为满足 `sale-bill.service.ts` 第 1 行 `import { ..., pool } from "../../shared/db"`
 * （该文件只 import 未使用 pool）。语义与 pool.query 一致：写语句返回 [ResultSetHeader]，读语句返回 [rows]。
 */
export const pool = {
  query: async (sql, params = []) => {
    const { rows, header } = rawRun(sql, params);
    return [header ?? rows, undefined];
  },
};
