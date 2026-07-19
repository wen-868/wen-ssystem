/**
 * SQLite 操作层 — uni-app 原生 SQLite Promise 封装
 *
 * 功能：
 *  1. 封装 uni.openDatabase / uni.executeSql / uni.selectSql / uni.closeDatabase 为 Promise 接口
 *  2. 初始化本地数据库 zhixiang_offline.db，创建 5 张本地表（对齐 R51 方案 1.1 节）：
 *     - local_product_sku      商品 SKU + 价格 + 库存冗余
 *     - local_member           客户
 *     - local_sale_draft       销售单草稿
 *     - local_inventory_snapshot 库存快照
 *     - sync_watermark         同步水位（4 个 since 字段）
 *  3. 通用操作：execute / query / transaction
 *  4. 条件编译：APP-PLUS 使用 uni 原生 SQLite；H5/小程序降级到内存存储（开发调试用）
 *
 * 注意：
 *  - 使用 IIFE 包裹条件编译，避免 vue-tsc 误报重复声明（踩坑日志 [15]）
 *  - SQL 参数使用 ? 占位符，由本层负责转义与拼接（uni.executeSql 在部分平台不支持参数数组）
 *  - 所有 SQL 表名/字段名使用 snake_case，与后端一致
 *
 * @author 阿澈
 */

// ====================== 类型定义 ======================

/** 通用查询行类型（动态键值对） */
export type DbRow = Record<string, any>

/** SQL 参数值类型 */
export type SqlParameter = string | number | boolean | null | undefined | SqlParameter[]

/** 数据库操作接口（APP-PLUS 原生实现 / H5 内存实现均满足此接口） */
export interface SQLiteOps {
    /** 打开数据库并完成建表 */
    open(): Promise<void>
    /** 执行非查询 SQL（INSERT/UPDATE/DELETE/CREATE/ALTER），返回受影响行数 */
    execute(sql: string, params?: SqlParameter[]): Promise<number>
    /** 查询 SQL（SELECT），返回行数组 */
    query<T = DbRow>(sql: string, params?: SqlParameter[]): Promise<T[]>
    /** 事务执行（单连接内顺序执行 fn 中的所有操作，失败回滚） */
    transaction<T>(fn: (ops: SQLiteOps) => Promise<T>): Promise<T>
    /** 关闭数据库 */
    close(): Promise<void>
}

// ====================== 常量定义 ======================

/** 本地数据库名称 */
const DB_NAME = 'zhixiang_offline.db'

/** 数据库初始化状态标记 */
let dbReady = false

/** 默认同步水位（UNIX 起始时间） */
const DEFAULT_SINCE = '1970-01-01T00:00:00Z'

// ====================== DDL：5 张本地表（对齐 R51 方案 1.1 节） ======================

const DDL_STATEMENTS: string[] = [
    // 1. 本地商品 SKU 表（含价格/库存冗余）
    `CREATE TABLE IF NOT EXISTS local_product_sku (
  id            INTEGER PRIMARY KEY,
  sku_id        INTEGER NOT NULL,
  spu_id        INTEGER NOT NULL,
  sku_code      TEXT,
  barcode       TEXT,
  sku_name      TEXT NOT NULL,
  volume        TEXT,
  packaging     TEXT,
  base_unit     TEXT DEFAULT '瓶',
  box_unit      TEXT DEFAULT '箱',
  box_ratio     INTEGER DEFAULT 1,
  temperature   TEXT DEFAULT 'NORMAL',
  trace_enabled INTEGER DEFAULT 0,
  status        INTEGER DEFAULT 1,
  spu_name      TEXT,
  category_id   INTEGER,
  category_name TEXT,
  brand_name    TEXT,
  main_image    TEXT,
  retail_price      REAL DEFAULT 0,
  wholesale_price   REAL DEFAULT 0,
  cost_price        REAL DEFAULT 0,
  miniapp_price     REAL DEFAULT 0,
  store_price       REAL DEFAULT 0,
  available_qty  INTEGER DEFAULT 0,
  warning_threshold INTEGER DEFAULT 0,
  server_updated_at TEXT,
  local_updated_at  TEXT DEFAULT (datetime('now')),
  is_dirty       INTEGER DEFAULT 0,
  tenant_id      TEXT NOT NULL,
  UNIQUE(sku_id, tenant_id)
)`,
    `CREATE INDEX IF NOT EXISTS idx_sku_barcode ON local_product_sku(barcode)`,
    `CREATE INDEX IF NOT EXISTS idx_sku_spu_id ON local_product_sku(spu_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sku_dirty ON local_product_sku(is_dirty)`,

    // 2. 本地客户表
    `CREATE TABLE IF NOT EXISTS local_member (
  id            INTEGER PRIMARY KEY,
  member_id     INTEGER NOT NULL UNIQUE,
  name          TEXT,
  phone         TEXT,
  customer_type TEXT DEFAULT 'RETAIL',
  address       TEXT,
  remark        TEXT,
  level_code    TEXT,
  debt_amount   REAL DEFAULT 0,
  status        INTEGER DEFAULT 1,
  local_updated_at  TEXT DEFAULT (datetime('now')),
  is_dirty       INTEGER DEFAULT 0,
  tenant_id      TEXT NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS idx_member_phone ON local_member(phone)`,

    // 3. 本地销售单草稿表
    `CREATE TABLE IF NOT EXISTS local_sale_draft (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_no        TEXT UNIQUE NOT NULL,
  customer_name   TEXT,
  customer_mobile TEXT,
  customer_id     INTEGER,
  items_json      TEXT NOT NULL,
  total_amount    REAL DEFAULT 0,
  remark          TEXT,
  status          TEXT DEFAULT 'DRAFT',
  created_at      TEXT DEFAULT (datetime('now')),
  synced_at       TEXT,
  error_msg       TEXT,
  tenant_id       TEXT NOT NULL
)`,
    `CREATE INDEX IF NOT EXISTS idx_draft_status ON local_sale_draft(status)`,

    // 4. 本地库存快照表
    `CREATE TABLE IF NOT EXISTS local_inventory_snapshot (
  id            INTEGER PRIMARY KEY,
  sku_id        INTEGER NOT NULL UNIQUE,
  available_qty INTEGER NOT NULL,
  stock_type    TEXT DEFAULT 'OFFLINE',
  store_id      INTEGER,
  synced_at     TEXT NOT NULL,
  tenant_id     TEXT NOT NULL
)`,

    // 5. 同步水位表（单行记录，id 固定为 1）
    `CREATE TABLE IF NOT EXISTS sync_watermark (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  product_since   TEXT DEFAULT '1970-01-01T00:00:00Z',
  price_since     TEXT DEFAULT '1970-01-01T00:00:00Z',
  inventory_since TEXT DEFAULT '1970-01-01T00:00:00Z',
  member_since    TEXT DEFAULT '1970-01-01T00:00:00Z',
  last_full_sync  TEXT
)`,
]

// ====================== SQL 参数转义 ======================

/**
 * 将单个参数转义为 SQL 字面量
 *  - 字符串：单引号包裹，内部 ' 转义为 ''
 *  - 数字：直接 String(n)
 *  - 布尔：true → 1，false → 0
 *  - null/undefined：NULL
 *  - 数组：递归处理后用逗号拼接，外层加括号
 *
 * @param param 参数值
 * @returns SQL 字面量字符串
 */
function escapeParam(param: SqlParameter): string {
    if (param === null || param === undefined) return 'NULL'
    if (Array.isArray(param)) {
        return `(${param.map(escapeParam).join(', ')})`
    }
    if (typeof param === 'number') {
        return Number.isFinite(param) ? String(param) : '0'
    }
    if (typeof param === 'boolean') {
        return param ? '1' : '0'
    }
    // 字符串：单引号包裹 + 转义内部单引号
    return `'${String(param).replace(/'/g, "''")}'`
}

/**
 * 将 SQL 中的 ? 占位符替换为实际参数
 *
 * 参数数量与 ? 数量必须一致，否则抛错。
 *
 * @param sql   含 ? 占位符的 SQL
 * @param params 参数数组
 * @returns 拼接后的完整 SQL
 */
function bindParams(sql: string, params?: SqlParameter[]): string {
    if (!params || params.length === 0) return sql
    let paramIdx = 0
    let result = ''
    let inSingleQuote = false
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i]
        if (ch === "'" && sql[i - 1] !== '\\') {
            inSingleQuote = !inSingleQuote
            result += ch
            continue
        }
        if (ch === '?' && !inSingleQuote) {
            if (paramIdx >= params.length) {
                throw new Error(`SQL 参数数量不足：${sql} 需要至少 ${paramIdx + 1} 个参数，实际 ${params.length} 个`)
            }
            result += escapeParam(params[paramIdx])
            paramIdx++
        } else {
            result += ch
        }
    }
    if (paramIdx < params.length) {
        throw new Error(`SQL 参数数量过多：${sql} 只需要 ${paramIdx} 个参数，实际传入 ${params.length} 个`)
    }
    return result
}

// ====================== H5 内存数据库实现（开发调试降级） ======================

/**
 * 简易内存数据库（仅用于 H5/非 APP-PLUS 环境开发调试）
 *
 * 支持基础 SQL：CREATE TABLE / INSERT / UPDATE / DELETE / SELECT
 * 不支持完整 SQL 语法，仅满足本任务 5 张表的 CRUD 场景。
 *
 * 实现策略：
 *  - 每个 CREATE TABLE 解析出表名和字段定义
 *  - INSERT 解析出表名、字段列表、VALUES
 *  - UPDATE/DELETE 解析 WHERE 条件（仅支持 AND 简单条件 + = / != / > / < / >= / <= / LIKE）
 *  - SELECT 解析字段、FROM、WHERE、ORDER BY、LIMIT、OFFSET
 */
class MemoryDatabase implements SQLiteOps {
    /** 表数据：表名 → 行数组 */
    private tables: Map<string, DbRow[]> = new Map()
    /** 表字段定义：表名 → 字段名数组 */
    private tableColumns: Map<string, string[]> = new Map()
    /** 表自增ID计数器：表名 → 当前最大 ID */
    private autoIncrementCounters: Map<string, number> = new Map()
    /** 事务中暂存的操作日志，用于回滚 */
    private transactionSnapshot: Map<string, DbRow[]> | null = null

    async open(): Promise<void> {
        // 内存库无需打开，直接执行 DDL
        for (const ddl of DDL_STATEMENTS) {
            await this.execute(ddl)
        }
    }

    async execute(sql: string, params?: SqlParameter[]): Promise<number> {
        const finalSql = bindParams(sql, params)
        const normalized = finalSql.trim().replace(/\s+/g, ' ').toUpperCase()
        // DDL：CREATE TABLE / CREATE INDEX
        if (normalized.startsWith('CREATE TABLE')) {
            this.handleCreateTable(finalSql)
            return 0
        }
        if (normalized.startsWith('CREATE INDEX') || normalized.startsWith('DROP INDEX')) {
            // 内存库忽略索引
            return 0
        }
        // INSERT
        if (normalized.startsWith('INSERT')) {
            return this.handleInsert(finalSql)
        }
        // UPDATE
        if (normalized.startsWith('UPDATE')) {
            return this.handleUpdate(finalSql)
        }
        // DELETE
        if (normalized.startsWith('DELETE')) {
            return this.handleDelete(finalSql)
        }
        // 其他语句忽略
        return 0
    }

    async query<T = DbRow>(sql: string, params?: SqlParameter[]): Promise<T[]> {
        const finalSql = bindParams(sql, params)
        return this.handleSelect<T>(finalSql)
    }

    async transaction<T>(fn: (ops: SQLiteOps) => Promise<T>): Promise<T> {
        // 简易事务：失败时回滚到快照
        this.transactionSnapshot = new Map()
        for (const [tableName, rows] of this.tables.entries()) {
            this.transactionSnapshot.set(tableName, rows.map((r) => ({ ...r })))
        }
        const snapshotCounters = new Map(this.autoIncrementCounters)
        try {
            const result = await fn(this)
            this.transactionSnapshot = null
            return result
        } catch (err) {
            // 回滚
            if (this.transactionSnapshot) {
                this.tables = this.transactionSnapshot
                this.autoIncrementCounters = snapshotCounters
                this.transactionSnapshot = null
            }
            throw err
        }
    }

    async close(): Promise<void> {
        // 内存库不释放
    }

    // ---------- DDL 解析 ----------

    private handleCreateTable(sql: string): void {
        const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]+)\)\s*$/i)
        if (!match) return
        const [, tableName, body] = match
        // 提取字段名（粗略解析，忽略约束行）
        const columns: string[] = []
        const lines = body.split(',').map((s) => s.trim()).filter(Boolean)
        for (const line of lines) {
            const upper = line.toUpperCase()
            // 跳过约束行
            if (upper.startsWith('PRIMARY KEY') || upper.startsWith('FOREIGN KEY') || upper.startsWith('CHECK') || upper.startsWith('UNIQUE') || upper.startsWith('KEY')) {
                continue
            }
            const colMatch = line.match(/^(\w+)\s+/)
            if (colMatch) {
                columns.push(colMatch[1])
            }
        }
        if (!this.tables.has(tableName)) {
            this.tables.set(tableName, [])
            this.tableColumns.set(tableName, columns)
            this.autoIncrementCounters.set(tableName, 0)
        }
    }

    // ---------- INSERT 解析 ----------

    private handleInsert(sql: string): number {
        const match = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([\s\S]+)\)\s*$/i)
        if (!match) {
            throw new Error(`[MemoryDB] 无法解析 INSERT: ${sql}`)
        }
        const [, tableName, columnsPart, valuesPart] = match
        const rows = this.tables.get(tableName) ?? []
        const allColumns = this.tableColumns.get(tableName) ?? []
        let columns: string[]
        if (columnsPart) {
            columns = columnsPart.split(',').map((s) => s.trim())
        } else {
            columns = allColumns
        }
        // 解析 VALUES（按逗号分割，但需处理字符串内的逗号）
        const values = this.parseValueList(valuesPart)
        const newRow: DbRow = {}
        // 自增主键处理
        const pkColumn = allColumns.find((c) => c.toLowerCase() === 'id')
        const hasAutoId = tableName === 'local_sale_draft' // local_sale_draft.id 是 AUTOINCREMENT
        let needAutoId = false
        columns.forEach((col, idx) => {
            newRow[col] = this.coerceValue(values[idx])
            if (col === pkColumn && (newRow[col] === null || newRow[col] === undefined)) {
                needAutoId = true
            }
        })
        if (pkColumn && needAutoId && hasAutoId) {
            const nextId = (this.autoIncrementCounters.get(tableName) ?? 0) + 1
            this.autoIncrementCounters.set(tableName, nextId)
            newRow[pkColumn] = nextId
        }
        // UPSERT 语义：UNIQUE 约束冲突时替换
        this.applyUpsert(tableName, rows, newRow, allColumns)
        this.tables.set(tableName, rows)
        return 1
    }

    /**
     * 应用 UPSERT 语义
     * 检测 UNIQUE 约束（sku_id+tenant_id / member_id / draft_no / sku_id+tenant_id）
     */
    private applyUpsert(tableName: string, rows: DbRow[], newRow: DbRow, _allColumns: string[]): void {
        const uniqueKeys = this.getUniqueKeys(tableName)
        const existIdx = rows.findIndex((r) =>
            uniqueKeys.some((keyCombo) => keyCombo.every((k) => r[k] === newRow[k]))
        )
        if (existIdx >= 0) {
            rows[existIdx] = { ...rows[existIdx], ...newRow }
        } else {
            rows.push(newRow)
        }
    }

    /** 返回每张表的 UNIQUE 约束组合 */
    private getUniqueKeys(tableName: string): string[][] {
        switch (tableName) {
            case 'local_product_sku':
                return [['sku_id', 'tenant_id']]
            case 'local_member':
                return [['member_id']]
            case 'local_sale_draft':
                return [['draft_no']]
            case 'local_inventory_snapshot':
                return [['sku_id', 'tenant_id']]
            case 'sync_watermark':
                return [['id']]
            default:
                return []
        }
    }

    /** 解析 VALUES 中的字面量列表 */
    private parseValueList(valuesPart: string): string[] {
        const result: string[] = []
        let current = ''
        let inQuote = false
        for (let i = 0; i < valuesPart.length; i++) {
            const ch = valuesPart[i]
            if (ch === "'") {
                if (inQuote && valuesPart[i + 1] === "'") {
                    current += "''"
                    i++
                    continue
                }
                inQuote = !inQuote
                current += ch
            } else if (ch === ',' && !inQuote) {
                result.push(current.trim())
                current = ''
            } else {
                current += ch
            }
        }
        if (current.trim()) result.push(current.trim())
        return result
    }

    /** 将 SQL 字面量转回 JS 值 */
    private coerceValue(literal: string): any {
        if (literal.toUpperCase() === 'NULL') return null
        if (literal.startsWith("'") && literal.endsWith("'")) {
            return literal.slice(1, -1).replace(/''/g, "'")
        }
        if (literal === '0' || literal === '1') {
            // 可能是布尔/数字，统一返回数字
            return Number(literal)
        }
        const num = Number(literal)
        if (!Number.isNaN(num) && literal.trim() !== '') {
            return num
        }
        return literal
    }

    // ---------- UPDATE 解析 ----------

    private handleUpdate(sql: string): number {
        const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)$/i)
        if (!match) {
            throw new Error(`[MemoryDB] 无法解析 UPDATE: ${sql}`)
        }
        const [, tableName, setPart, wherePart] = match
        const rows = this.tables.get(tableName) ?? []
        // 解析 SET 字段
        const setPairs: Array<{ column: string; value: any }> = []
        const setTokens = this.splitByComma(setPart)
        for (const token of setTokens) {
            const m = token.match(/^(\w+)\s*=\s*(.+)$/)
            if (m) {
                setPairs.push({ column: m[1], value: this.coerceValue(m[2].trim()) })
            }
        }
        let affected = 0
        for (const row of rows) {
            if (this.matchWhere(row, wherePart)) {
                for (const pair of setPairs) {
                    row[pair.column] = pair.value
                }
                affected++
            }
        }
        return affected
    }

    /** 按逗号分割，忽略引号内的逗号 */
    private splitByComma(input: string): string[] {
        const result: string[] = []
        let current = ''
        let inQuote = false
        for (let i = 0; i < input.length; i++) {
            const ch = input[i]
            if (ch === "'") {
                if (inQuote && input[i + 1] === "'") {
                    current += "''"
                    i++
                    continue
                }
                inQuote = !inQuote
                current += ch
            } else if (ch === ',' && !inQuote) {
                result.push(current.trim())
                current = ''
            } else {
                current += ch
            }
        }
        if (current.trim()) result.push(current.trim())
        return result
    }

    // ---------- DELETE 解析 ----------

    private handleDelete(sql: string): number {
        const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i)
        if (!match) {
            throw new Error(`[MemoryDB] 无法解析 DELETE: ${sql}`)
        }
        const [, tableName, wherePart] = match
        const rows = this.tables.get(tableName) ?? []
        if (!wherePart) {
            const affected = rows.length
            rows.length = 0
            return affected
        }
        const original = rows.length
        const remaining = rows.filter((r) => !this.matchWhere(r, wherePart))
        const affected = original - remaining.length
        this.tables.set(tableName, remaining)
        return affected
    }

    // ---------- SELECT 解析 ----------

    private handleSelect<T>(sql: string): T[] {
        const match = sql.match(
            /SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?\s*$/i
        )
        if (!match) {
            throw new Error(`[MemoryDB] 无法解析 SELECT: ${sql}`)
        }
        const [, columnsPart, tableName, wherePart, orderByPart, limitStr, offsetStr] = match
        const rows = this.tables.get(tableName) ?? []
        // WHERE 过滤
        let filtered = wherePart ? rows.filter((r) => this.matchWhere(r, wherePart)) : rows.slice()
        // ORDER BY（支持单字段 + ASC/DESC）
        if (orderByPart) {
            const m = orderByPart.trim().match(/^(\w+)(?:\s+(ASC|DESC))?$/i)
            if (m) {
                const [, col, dir] = m
                const direction = (dir || 'ASC').toUpperCase() as 'ASC' | 'DESC'
                filtered = filtered.slice().sort((a, b) => {
                    const av = a[col]
                    const bv = b[col]
                    if (av === bv) return 0
                    if (av === null || av === undefined) return direction === 'ASC' ? -1 : 1
                    if (bv === null || bv === undefined) return direction === 'ASC' ? 1 : -1
                    if (av < bv) return direction === 'ASC' ? -1 : 1
                    return direction === 'ASC' ? 1 : -1
                })
            }
        }
        // OFFSET
        const offset = offsetStr ? Number(offsetStr) : 0
        if (offset > 0) filtered = filtered.slice(offset)
        // LIMIT
        if (limitStr) {
            filtered = filtered.slice(0, Number(limitStr))
        }
        // 字段投影
        const trimmedCols = columnsPart.trim()
        if (trimmedCols === '*') {
            return filtered as T[]
        }
        const columns = trimmedCols.split(',').map((c) => {
            const m = c.trim().match(/^(?:\w+\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?$/i)
            if (!m) return null
            return { column: m[1], alias: m[2] || m[1] }
        }).filter(Boolean) as Array<{ column: string; alias: string }>
        return filtered.map((row) => {
            const projected: DbRow = {}
            for (const c of columns) {
                projected[c.alias] = row[c.column]
            }
            return projected as T
        })
    }

    /** WHERE 条件匹配（仅支持 AND 连接的简单条件） */
    private matchWhere(row: DbRow, wherePart: string): boolean {
        // 拆分 AND
        const conditions = wherePart.split(/\s+AND\s+/i)
        for (const cond of conditions) {
            if (!this.matchCondition(row, cond.trim())) return false
        }
        return true
    }

    /** 单个条件匹配 */
    private matchCondition(row: DbRow, cond: string): boolean {
        // 支持 =、!=、<>、>、<、>=、<=、LIKE、IS NULL、IS NOT NULL
        const m = cond.match(/^(\w+)\s+(IS\s+NOT\s+NULL|IS\s+NULL|>=|<=|<>|!=|=|>|<|LIKE)\s+(.+)$/i)
        if (!m) {
            // 兼容 column=value 紧凑形式
            const m2 = cond.match(/^(\w+)\s*=\s*(.+)$/)
            if (m2) {
                const [, col, val] = m2
                return row[col] === this.coerceValue(val.trim())
            }
            return true
        }
        const [, col, opRaw, valRaw] = m
        const op = opRaw.toUpperCase().replace(/\s+/g, ' ')
        const val = this.coerceValue(valRaw.trim())
        const rowVal = row[col]
        if (op === 'IS NULL') return rowVal === null || rowVal === undefined
        if (op === 'IS NOT NULL') return rowVal !== null && rowVal !== undefined
        if (op === 'LIKE') {
            const pattern = String(val).replace(/%/g, '.*').replace(/_/g, '.')
            return new RegExp(`^${pattern}$`, 'i').test(String(rowVal ?? ''))
        }
        switch (op) {
            case '=':
                return rowVal === val
            case '!=':
            case '<>':
                return rowVal !== val
            case '>':
                return Number(rowVal) > Number(val)
            case '<':
                return Number(rowVal) < Number(val)
            case '>=':
                return Number(rowVal) >= Number(val)
            case '<=':
                return Number(rowVal) <= Number(val)
            default:
                return true
        }
    }
}

// ====================== APP-PLUS 原生 SQLite 实现 ======================

/**
 * 基于 uni.openDatabase / uni.executeSql / uni.selectSql 的原生实现
 *
 * 注意：
 *  - uni.executeSql 不返回受影响行数（res.affectedRows 在部分平台不可用），统一返回 1
 *  - 事务通过 BEGIN / COMMIT / ROLLBACK 实现
 */
class NativeDatabase implements SQLiteOps {
    async open(): Promise<void> {
        await this.callOpen()
        // 执行 DDL
        for (const ddl of DDL_STATEMENTS) {
            await this.callExecuteSql(ddl)
        }
        // 初始化 sync_watermark 单行记录（INSERT OR IGNORE）
        await this.callExecuteSql(
            `INSERT OR IGNORE INTO sync_watermark (id, product_since, price_since, inventory_since, member_since) VALUES (1, '${DEFAULT_SINCE}', '${DEFAULT_SINCE}', '${DEFAULT_SINCE}', '${DEFAULT_SINCE}')`
        )
    }

    async execute(sql: string, params?: SqlParameter[]): Promise<number> {
        const finalSql = bindParams(sql, params)
        await this.callExecuteSql(finalSql)
        // uni.executeSql 不返回受影响行数，统一返回 1
        return 1
    }

    async query<T = DbRow>(sql: string, params?: SqlParameter[]): Promise<T[]> {
        const finalSql = bindParams(sql, params)
        return this.callSelectSql<T>(finalSql)
    }

    async transaction<T>(fn: (ops: SQLiteOps) => Promise<T>): Promise<T> {
        await this.callExecuteSql('BEGIN TRANSACTION')
        try {
            const result = await fn(this)
            await this.callExecuteSql('COMMIT')
            return result
        } catch (err) {
            try {
                await this.callExecuteSql('ROLLBACK')
            } catch {
                // 回滚失败忽略
            }
            throw err
        }
    }

    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            uni.closeDatabase({
                name: DB_NAME,
                success: () => resolve(),
                fail: (err: any) => reject(new Error(`关闭数据库失败: ${err?.errMsg || '未知错误'}`)),
            })
        })
    }

    // ---------- uni API 调用包装 ----------

    private callOpen(): Promise<void> {
        return new Promise((resolve, reject) => {
            uni.openDatabase({
                name: DB_NAME,
                // path 留空使用默认 _doc/ 目录
                success: () => resolve(),
                fail: (err: any) => reject(new Error(`打开数据库失败: ${err?.errMsg || '未知错误'}`)),
            } as any)
        })
    }

    private callExecuteSql(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            uni.executeSql({
                name: DB_NAME,
                sql,
                success: () => resolve(),
                fail: (err: any) => reject(new Error(`执行 SQL 失败: ${err?.errMsg || '未知错误'} | SQL: ${sql}`)),
            } as any)
        })
    }

    private callSelectSql<T>(sql: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            uni.selectSql({
                name: DB_NAME,
                sql,
                success: (res: any) => {
                    // res.data 为查询结果数组
                    resolve((res?.data ?? []) as T[])
                },
                fail: (err: any) => reject(new Error(`查询 SQL 失败: ${err?.errMsg || '未知错误'} | SQL: ${sql}`)),
            } as any)
        })
    }
}

// ====================== 平台适配（IIFE 包裹条件编译，踩坑日志 [15]） ======================

/**
 * 获取 SQLiteOps 实现
 *  - APP-PLUS：使用 NativeDatabase（uni 原生 SQLite）
 *  - 其他平台（H5/小程序）：使用 MemoryDatabase（开发调试降级）
 */
function createSqliteOps(): SQLiteOps {
    return (() => {
        // #ifdef APP-PLUS
        return new NativeDatabase()
        // #endif
        // #ifndef APP-PLUS
        return new MemoryDatabase()
        // #endif
    })()
}

/** 单例 ops 实例 */
let opsInstance: SQLiteOps | null = null

/**
 * 获取 SQLiteOps 单例
 * 首次调用会创建实例（但不会打开数据库，需调用 initDatabase 完成初始化）
 */
function getOps(): SQLiteOps {
    if (!opsInstance) {
        opsInstance = createSqliteOps()
    }
    return opsInstance
}

// ====================== 对外 API ======================

/**
 * 初始化本地数据库
 *
 *  - 打开数据库 zhixiang_offline.db
 *  - 执行 5 张表的 DDL
 *  - 初始化 sync_watermark 单行记录
 *
 * 幂等：重复调用安全
 *
 * @example
 * ```ts
 * import { initDatabase } from '@/native/sqlite'
 * await initDatabase()
 * ```
 */
export async function initDatabase(): Promise<void> {
    if (dbReady) return
    const ops = getOps()
    await ops.open()
    // H5 内存实现也需要初始化 sync_watermark 单行记录（NativeDatabase 已在 open 中处理，这里再保险一次）
    try {
        await ops.execute(
            `INSERT OR IGNORE INTO sync_watermark (id, product_since, price_since, inventory_since, member_since) VALUES (1, ?, ?, ?, ?)`,
            [DEFAULT_SINCE, DEFAULT_SINCE, DEFAULT_SINCE, DEFAULT_SINCE]
        )
    } catch {
        // 已存在则忽略
    }
    dbReady = true
}

/**
 * 执行非查询 SQL（INSERT/UPDATE/DELETE/CREATE/ALTER）
 *
 * @param sql    含 ? 占位符的 SQL
 * @param params 参数数组
 * @returns 受影响行数（APP-PLUS 平台固定返回 1，H5 内存实现返回真实行数）
 *
 * @example
 * ```ts
 * await execute(
 *   'INSERT INTO local_product_sku (sku_id, spu_id, sku_name, tenant_id) VALUES (?, ?, ?, ?)',
 *   [1001, 2001, '茅台飞天', 'tenant-1']
 * )
 * ```
 */
export async function execute(sql: string, params?: SqlParameter[]): Promise<number> {
    if (!dbReady) await initDatabase()
    return getOps().execute(sql, params)
}

/**
 * 查询 SQL，返回行数组
 *
 * @param sql    含 ? 占位符的 SELECT SQL
 * @param params 参数数组
 * @returns 查询结果行数组
 *
 * @example
 * ```ts
 * const rows = await query<{ sku_id: number; sku_name: string }>(
 *   'SELECT sku_id, sku_name FROM local_product_sku WHERE barcode = ?',
 *   ['6901234567890']
 * )
 * ```
 */
export async function query<T = DbRow>(sql: string, params?: SqlParameter[]): Promise<T[]> {
    if (!dbReady) await initDatabase()
    return getOps().query<T>(sql, params)
}

/**
 * 事务执行
 *
 * 在事务中执行多个操作，任一失败则全部回滚。
 *
 * @param fn 事务函数，接收 ops 参数（提供 execute/query 方法）
 * @returns fn 的返回值
 *
 * @example
 * ```ts
 * await transaction(async (tx) => {
 *   await tx.execute('INSERT INTO ...', [...])
 *   await tx.execute('UPDATE ... SET ...', [...])
 * })
 * ```
 */
export async function transaction<T>(fn: (ops: Pick<SQLiteOps, 'execute' | 'query'>) => Promise<T>): Promise<T> {
    if (!dbReady) await initDatabase()
    return getOps().transaction(fn as (ops: SQLiteOps) => Promise<T>)
}

/**
 * 关闭数据库连接
 *
 * App 退出或登出时调用，释放原生资源。
 */
export async function closeDatabase(): Promise<void> {
    if (!opsInstance) return
    await opsInstance.close()
    opsInstance = null
    dbReady = false
}

/**
 * 重置数据库状态（主要用于登出/切换租户场景清空本地数据）
 *
 * 注意：此操作不可逆，会删除所有本地表数据
 */
export async function resetDatabase(): Promise<void> {
    if (!dbReady) await initDatabase()
    const ops = getOps()
    await ops.execute('DELETE FROM local_product_sku')
    await ops.execute('DELETE FROM local_member')
    await ops.execute('DELETE FROM local_sale_draft')
    await ops.execute('DELETE FROM local_inventory_snapshot')
    await ops.execute(
        `UPDATE sync_watermark SET product_since = ?, price_since = ?, inventory_since = ?, member_since = ?, last_full_sync = NULL WHERE id = 1`,
        [DEFAULT_SINCE, DEFAULT_SINCE, DEFAULT_SINCE, DEFAULT_SINCE]
    )
}

// ====================== 导出 ======================

export {
    DB_NAME,
    DEFAULT_SINCE,
}
