#!/usr/bin/env node
/**
 * 生产 schema 体检脚本（R95-04）
 *
 * 用途：对比「代码期望的数据库结构」与「生产 information_schema 实际结构」，
 *       输出缺表 / 缺列 / 列类型不匹配 三类差异报告，暴露 mock 库掩盖的结构漂移。
 *
 * 用法：
 *   node scripts/schema-audit.mjs                 # 连接生产 MySQL（读 .env），输出报告
 *   node scripts/schema-audit.mjs --mock          # 不连接数据库，仅扫描代码期望结构（本地演示）
 *   node scripts/schema-audit.mjs --db-host x --db-user x --db-password x --db-name x
 *
 * 只读：仅查询 information_schema，不修改任何数据。
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import mysql from "mysql2/promise";

const ROOT = resolve(process.cwd());
const SRC_DIR = resolve(ROOT, "backend/src");
const MIGRATIONS_DIR = resolve(ROOT, "docs/migrations");
const INIT_SQL = resolve(ROOT, "docs/init_database.sql");
const REPORTS_DIR = resolve(ROOT, "docs/reports");

const args = process.argv.slice(2);
const IS_MOCK = args.includes("--mock") || process.env.USE_MOCK_DB === "true";

// ---------------- .env 加载（backend/.env 优先，其次项目根 .env） ----------------
function loadEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  const content = readFileSync(filePath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const fileEnv = { ...loadEnvFile(resolve(ROOT, ".env")), ...loadEnvFile(resolve(ROOT, "backend/.env")) };
const DB_CONFIG = {
  host: getArgValue("--db-host") || process.env.DB_HOST || fileEnv.DB_HOST || "127.0.0.1",
  port: Number(getArgValue("--db-port") || process.env.DB_PORT || fileEnv.DB_PORT || 3306),
  user: getArgValue("--db-user") || process.env.DB_USER || fileEnv.DB_USER || "root",
  password: getArgValue("--db-password") || process.env.DB_PASSWORD || fileEnv.DB_PASSWORD || "",
  database: getArgValue("--db-name") || process.env.DB_NAME || fileEnv.DB_NAME || "liquor_inventory",
};

// ---------------- 1. 扫描 backend/src 代码引用（表 + 列） ----------------
const SQL_KEYWORDS = new Set([
  "select", "from", "where", "join", "left", "right", "inner", "outer", "on", "and", "or",
  "insert", "into", "values", "update", "set", "delete", "group", "order", "by", "having",
  "limit", "offset", "as", "distinct", "count", "sum", "avg", "max", "min", "case", "when",
  "then", "else", "end", "is", "null", "not", "like", "in", "between", "exists", "union",
  "all", "asc", "desc", "date", "now", "coalesce", "ifnull", "concat", "if", "substring",
  "cast", "convert", "trim", "length", "replace", "round", "abs", "floor", "ceil", "true",
  "false", "returning", "with", "recursive", "over", "partition", "rank", "row_number",
  "desc", "asc", "using", "cross", "natural", "full", "inner", "outer",
]);

// 常见 SQL 聚合/函数名，SELECT 列表裸字段提取时排除
const SQL_FUNCTIONS = new Set([
  "avg", "count", "sum", "max", "min", "group_concat", "distinct", "coalesce",
  "ifnull", "nullif", "concat", "concat_ws", "substring", "substring_index",
  "left", "right", "mid", "length", "char_length", "replace", "trim", "ltrim",
  "rtrim", "lower", "upper", "ucase", "lcase", "reverse", "repeat", "space",
  "locate", "instr", "position", "find_in_set", "field", "elt", "format",
  "round", "floor", "ceil", "ceiling", "abs", "mod", "pow", "power", "sqrt",
  "rand", "sign", "truncate", "date", "time", "year", "month", "day", "hour",
  "minute", "second", "now", "curdate", "curtime", "current_date", "current_time",
  "current_timestamp", "datediff", "timediff", "timestampdiff", "timestampadd",
  "date_add", "date_sub", "date_format", "str_to_date", "unix_timestamp",
  "from_unixtime", "cast", "convert", "if", "case", "interval", "json_extract",
  "json_unquote", "json_array", "json_object", "json_contains", "json_length",
  "json_keys", "json_search", "uuid", "uuid_short", "md5", "sha1", "sha2",
  "database", "schema", "version", "connection_id", "last_insert_id",
  "row_number", "rank", "dense_rank", "percent_rank", "cume_dist", "ntile",
  "lag", "lead", "first_value", "last_value", "nth_value", "over", "partition",
  "yearweek", "week", "weekday", "dayofweek", "dayofyear", "dayofmonth",
  "quarter", "last_day", "adddate", "subdate", "makedate", "maketime",
  "hour", "microsecond", "extract", "greatest", "least", "bit_length", "char",
  "ord", "quote", "soundex", "space", "strcmp", "substr", "elt", "export_set",
  "make_set", "oct", "octet_length", "bit_count", "crc32", "encrypt", "decode",
  "encode", "password", "old_password", "des_decrypt", "des_encrypt",
  "inet_aton", "inet_ntoa", "master_pos_wait", "name_const", "release_lock",
  "sleep", "get_lock", "benchmark", "isnull", "is_free_lock", "is_used_lock",
  "matches", "normalized", "vector", "distance", "similarity", "json",
  "bool", "boolean", "smallint", "mediumint", "bigint", "decimal", "float",
  "double", "real", "bit", "date", "datetime", "timestamp", "time", "year",
  "char", "varchar", "text", "tinytext", "mediumtext", "longtext", "binary",
  "varbinary", "blob", "tinyblob", "mediumblob", "longblob", "enum", "set",
  "geometry", "point", "linestring", "polygon", "multipoint", "multilinestring",
  "multipolygon", "geometrycollection", "json_valid",
]);

function collectSourceFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // 跳过测试目录，避免 mock 函数名误报为列
      if (name === "__tests__" || name === "test" || name === "tests") continue;
      files.push(...collectSourceFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".spec.ts")) {
      files.push(full);
    }
  }
  return files;
}

/** 从一段代码中提取所有 SQL 相关语句块（按分号切分，保留含 t_ 表的块） */
function extractSqlBlocks(content) {
  // 去掉注释与字符串字面量中的干扰：先粗粒度按行切，只保留含 SQL 关键字的行区域
  const blocks = [];
  const stmtParts = content.split(";");
  for (const part of stmtParts) {
    if (/t_[a-z0-9_]+/i.test(part)) {
      blocks.push(part);
    }
  }
  return blocks;
}

/** 解析一段 SQL 块：返回 { table: string, alias: string|null, columns: Set<string> } */
function parseSqlBlock(block) {
  const results = [];
  // 表引用：FROM/JOIN/INTO/UPDATE t_xxx (可选别名)
  const tableRe = /(?:FROM|JOIN|INTO|UPDATE)\s+`?(t_[a-z0-9_]+)`?(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi;
  let m;
  while ((m = tableRe.exec(block)) !== null) {
    const table = m[1].toLowerCase();
    const alias = m[2] ? m[2].toLowerCase() : null;
    const columns = new Set();

    // a) INSERT INTO t_xxx (col1, col2) 括号列
    const insertColRe = new RegExp(
      "INSERT\\s+INTO\\s+`?" + escapeRe(table) + "`?\\s*\\(([^)]*)\\)",
      "gi",
    );
    let im;
    while ((im = insertColRe.exec(block)) !== null) {
      for (const col of im[1].split(",")) {
        const c = col.trim().replace(/^`+|`+$/g, "");
        if (/^[a-z_][a-z0-9_]*$/i.test(c)) columns.add(c.toLowerCase());
      }
    }

    // b) UPDATE t_xxx SET col = ... 列
    const updateColRe = new RegExp(
      "UPDATE\\s+`?" + escapeRe(table) + "`?\\s+SET\\s+([\\s\\S]*?)(?:WHERE|;|$)",
      "gi",
    );
    let um;
    while ((um = updateColRe.exec(block)) !== null) {
      const setPart = um[1];
      for (const match of setPart.matchAll(/([a-z_][a-z0-9_]*)\s*=/gi)) {
        const c = match[1].toLowerCase();
        if (!SQL_KEYWORDS.has(c)) columns.add(c);
      }
    }

    // c) t_xxx.column 显式引用
    const tableColRe = new RegExp(escapeRe(table) + "\\s*\\.\\s*([a-z_][a-z0-9_]*)", "gi");
    let cm;
    while ((cm = tableColRe.exec(block)) !== null) {
      columns.add(cm[1].toLowerCase());
    }

    // c2) alias.column 显式引用（仅当本块为该表声明了别名时）
    if (alias) {
      const aliasColRe = new RegExp("\\b" + escapeRe(alias) + "\\s*\\.\\s*([a-z_][a-z0-9_]*)", "gi");
      let am;
      while ((am = aliasColRe.exec(block)) !== null) {
        columns.add(am[1].toLowerCase());
      }
    }

    // d) SELECT ... FROM t_xxx 之间的裸列（排除函数与关键字）
    const selectRe = /SELECT\s+([\s\S]*?)\s+FROM/i;
    const sm = selectRe.exec(block);
    if (sm && /t_[a-z0-9_]+/i.test(block)) {
      for (const field of sm[1].split(",")) {
        let f = field.trim();
        f = f.replace(/AS\s+[a-z_][a-z0-9_]*$/i, "").trim();
        // 剥离全部表别名前缀：p.brand_id → brand_id、COALESCE(s.sold_qty) → COALESCE(sold_qty)
        f = f.replace(/\b[a-z_][a-z0-9_]*\./g, "");
        // 提取字段表达式中的所有标识符，跳过函数名/关键字/数字/星号
        const idRe = /([a-z_][a-z0-9_]*)/gi;
        let im;
        while ((im = idRe.exec(f)) !== null) {
          const candidate = im[1].toLowerCase();
          if (SQL_KEYWORDS.has(candidate) || SQL_FUNCTIONS.has(candidate)) continue;
          if (candidate === "as" || /^\d/.test(candidate)) continue;
          columns.add(candidate);
          break; // 每个字段只取第一个非函数标识符（避免 AS 别名等重复）
        }
      }
    }

    results.push({ table, alias, columns });
  }
  return results;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scanCode() {
  const tableColumns = new Map(); // table -> Set<column>
  const sourceFiles = collectSourceFiles(SRC_DIR);
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf-8");
    for (const block of extractSqlBlocks(content)) {
      for (const { table, columns } of parseSqlBlock(block)) {
        if (!tableColumns.has(table)) tableColumns.set(table, new Set());
        for (const c of columns) tableColumns.get(table).add(c);
      }
    }
  }
  return tableColumns;
}

// ---------------- 2. 解析迁移 DDL（期望列类型） ----------------
function parseCreateTable(sql) {
  const tables = new Map(); // table -> Map<column, type>
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(t_[a-z0-9_]+)`?\s*\(([\s\S]*?)\)\s*(?:ENGINE|DEFAULT|COMMENT|;)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const cols = new Map();
    for (const lineRaw of m[2].split("\n")) {
      const line = lineRaw.trim();
      if (!line || line.startsWith("--") || /^(KEY|INDEX|UNIQUE|PRIMARY|FOREIGN|CONSTRAINT|FULLTEXT)/i.test(line)) continue;
      const cm = line.match(/^`?([a-z_][a-z0-9_]*)`?\s+([A-Z]+(?:\s*\([^)]*\))?)/i);
      if (cm) cols.set(cm[1].toLowerCase(), cm[2].toUpperCase().replace(/\s+/g, " "));
    }
    tables.set(table, cols);
  }
  return tables;
}

function loadDdlExpectation() {
  const expectation = new Map(); // table -> Map<column, type>
  const merge = (sql) => {
    for (const [table, cols] of parseCreateTable(sql)) {
      if (!expectation.has(table)) expectation.set(table, new Map());
      for (const [col, type] of cols) {
        if (!expectation.get(table).has(col)) expectation.get(table).set(col, type);
      }
    }
    // 补充 ALTER TABLE ... ADD COLUMN 定义（R95-04-5：此前未纳入类型期望）
    const alterRe = /ALTER\s+TABLE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+ADD\s+COLUMN\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let m;
    while ((m = alterRe.exec(sql))) {
      const table = m[1].toLowerCase();
      if (!expectation.has(table)) expectation.set(table, new Map());
      const col = m[2].toLowerCase();
      if (!expectation.get(table).has(col)) expectation.get(table).set(col, m[3].toLowerCase());
    }
  };
  if (existsSync(INIT_SQL)) merge(readFileSync(INIT_SQL, "utf-8"));
  if (existsSync(MIGRATIONS_DIR)) {
    for (const name of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      merge(readFileSync(join(MIGRATIONS_DIR, name), "utf-8"));
    }
  }
  return expectation;
}

// ---------------- 3. 连接生产 MySQL 读取实际结构 ----------------
async function fetchActualSchema() {
  const conn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
    connectTimeout: 10000,
  });
  const [tablesRows] = await conn.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
    [DB_CONFIG.database],
  );
  const [columnsRows] = await conn.query(
    `SELECT table_name, column_name, data_type, column_type
       FROM information_schema.columns
      WHERE table_schema = ?`,
    [DB_CONFIG.database],
  );
  await conn.end();

  const actual = new Map(); // table -> Map<column, {dataType, columnType}>
  for (const t of tablesRows) actual.set(t.TABLE_NAME.toLowerCase(), new Map());
  for (const c of columnsRows) {
    const table = c.TABLE_NAME.toLowerCase();
    if (!actual.has(table)) actual.set(table, new Map());
    actual.get(table).set(c.COLUMN_NAME.toLowerCase(), {
      dataType: c.DATA_TYPE,
      columnType: c.COLUMN_TYPE,
    });
  }
  return actual;
}

// ---------------- 4. 对比并输出 Markdown 报告 ----------------
function normalizeType(type) {
  // information_schema 的 DATA_TYPE 与 DDL 类型名近似归一（去掉长度/精度）
  return String(type || "").toLowerCase().replace(/\(.*\)/g, "").trim();
}

function compare(codeExpect, ddlExpect, actual) {
  const report = {
    missingTables: [],          // 迁移 DDL 有定义但生产缺失的表（可信缺表）
    driftTables: [],            // 代码引用但无 DDL 定义且生产缺失（结构漂移，需人工核实）
    missingColumns: new Map(),  // 迁移 DDL 定义列但表内缺失（可信缺列）
    typeMismatches: new Map(),  // table -> Map<column, {expected, actual}>
  };

  // 可信缺表：迁移 DDL 有定义、生产缺失
  for (const table of ddlExpect.keys()) {
    if (!actual.has(table)) report.missingTables.push(table);
  }
  // 代码漂移表：代码引用、DDL 无定义、生产缺失（提示人工核实，不作为缺表）
  for (const table of codeExpect.keys()) {
    if (!actual.has(table) && !ddlExpect.has(table)) report.driftTables.push(table);
  }

  // 可信缺列：迁移 DDL 定义列 vs 生产实际
  for (const [table, ddlCols] of ddlExpect) {
    if (!actual.has(table)) continue;
    const actualCols = actual.get(table);
    for (const col of ddlCols.keys()) {
      if (!actualCols.has(col)) {
        if (!report.missingColumns.has(table)) report.missingColumns.set(table, new Set());
        report.missingColumns.get(table).add(col);
      }
    }
  }

  // 类型对比以迁移 DDL 期望为准（仅对比两边都有定义的列）
  for (const [table, ddlCols] of ddlExpect) {
    if (!actual.has(table)) continue;
    const actualCols = actual.get(table);
    for (const [col, expectedType] of ddlCols) {
      if (!actualCols.has(col)) continue;
      const actualType = normalizeType(actualCols.get(col).dataType);
      const expType = normalizeType(expectedType);
      if (actualType !== expType) {
        if (!report.typeMismatches.has(table)) report.typeMismatches.set(table, new Map());
        report.typeMismatches.get(table).set(col, { expected: expType, actual: actualType });
      }
    }
  }
  return report;
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderReport(report, meta) {
  const lines = [];
  lines.push("# 生产 Schema 体检报告");
  lines.push("");
  lines.push(`> 日期：${meta.date}　模式：${meta.mode}`);
  lines.push(`> 代码来源：${meta.srcDir}`);
  lines.push(`> 数据库：${meta.dbHost}:${meta.dbPort}/${meta.dbName}`);
  lines.push("");
  lines.push("## 结论");
  lines.push("");
  const missingTableCount = report.missingTables.length;
  const missingColCount = [...report.missingColumns.values()].reduce((n, s) => n + s.size, 0);
  const typeMismatchCount = [...report.typeMismatches.values()].reduce((n, m) => n + m.size, 0);
  const driftTableCount = report.driftTables.length;
  if (missingTableCount + missingColCount + typeMismatchCount === 0) {
    lines.push("✅ 未发现结构差异：迁移 DDL 定义的表/列均存在，类型与生产一致。");
  } else {
    lines.push(`⚠️ 发现结构差异 ${missingTableCount + missingColCount + typeMismatchCount} 处：`);
    lines.push(`- 缺表（迁移 DDL 定义但生产缺失）：${missingTableCount} 张`);
    lines.push(`- 缺列（迁移 DDL 定义列但表内缺失）：${missingColCount} 列`);
    lines.push(`- 类型不匹配：${typeMismatchCount} 列`);
  }
  if (driftTableCount > 0) {
    lines.push(`- 代码漂移表（代码引用但无 DDL 定义，需人工核实）：${driftTableCount} 张`);
  }
  lines.push("");

  lines.push("## 一、缺表（迁移 DDL 定义但生产缺失）");
  lines.push("");
  if (report.missingTables.length === 0) {
    lines.push("无。");
  } else {
    lines.push("| 表名 | 引用来源 |");
    lines.push("|------|---------|");
    for (const t of report.missingTables.sort()) {
      lines.push(`| \`${t}\` | backend/src 代码（正则提取） |`);
    }
  }
  lines.push("");

  lines.push("## 二、缺列（迁移 DDL 定义列但表内缺失）");
  lines.push("");
  if (missingColCount === 0) {
    lines.push("无。");
  } else {
    lines.push("| 表名 | 缺失列 |");
    lines.push("|------|--------|");
    for (const [table, cols] of [...report.missingColumns.entries()].sort()) {
      lines.push(`| \`${table}\` | ${[...cols].sort().map((c) => `\`${c}\``).join("、")} |`);
    }
  }
  lines.push("");

  lines.push("## 三、列类型不匹配（迁移 DDL 期望 vs 生产实际）");
  lines.push("");
  if (typeMismatchCount === 0) {
    lines.push("无。");
  } else {
    lines.push("| 表名 | 列 | 期望类型 | 实际类型 |");
    lines.push("|------|-----|---------|---------|");
    for (const [table, cols] of [...report.typeMismatches.entries()].sort()) {
      for (const [col, info] of [...cols.entries()].sort()) {
        lines.push(`| \`${table}\` | \`${col}\` | ${info.expected} | ${info.actual} |`);
      }
    }
  }
  lines.push("");
  lines.push("## 四、代码漂移表（代码引用但无 DDL 定义且生产缺失）");
  lines.push("");
  if (driftTableCount === 0) {
    lines.push("无。");
  } else {
    lines.push("> 这些表被 backend/src 代码引用，但迁移 DDL 无对应 CREATE/ALTER 定义，属结构漂移。需人工核实：补建表或修正代码引用，不自动补建。");
    lines.push("");
    lines.push(`\`${report.driftTables.sort().join("`、`")}\``);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 附注");
  lines.push("");
  lines.push("- 缺表/缺列以迁移 DDL（`docs/init_database.sql` + `docs/migrations/*.sql` 的 `CREATE TABLE` 与 `ALTER TABLE ADD COLUMN`）为期望基线，剔除代码正则误报。");
  lines.push("- 代码漂移表单独列出（代码引用但无 DDL 定义），需人工核实后决定补建或修正代码。");
  lines.push("- 本脚本只读 information_schema，不修改数据库。");
  lines.push("");
  return lines.join("\n");
}

function renderMockReport(codeExpect, ddlExpect, meta) {
  const lines = [];
  lines.push("# Schema 体检报告（mock 模式）");
  lines.push("");
  lines.push(`> 日期：${meta.date}　模式：mock（未连接数据库，仅代码期望结构）`);
  lines.push(`> 代码来源：${meta.srcDir}`);
  lines.push("");
  lines.push("## 一、代码引用的表与列（backend/src 正则提取）");
  lines.push("");
  lines.push(`共引用 **${codeExpect.size}** 张表：`);
  lines.push("");
  for (const [table, cols] of [...codeExpect.entries()].sort()) {
    lines.push(`- \`${table}\`（${cols.size} 列）：${[...cols].sort().slice(0, 40).map((c) => `\`${c}\``).join("、")}${cols.size > 40 ? `…等 ${cols.size} 列` : ""}`);
  }
  lines.push("");
  lines.push("## 二、迁移 DDL 期望表（init_database.sql + docs/migrations/*.sql）");
  lines.push("");
  lines.push(`共 **${ddlExpect.size}** 张表。连接生产数据库后，将用 information_schema 对比缺表/缺列/类型不匹配。`);
  lines.push("");
  lines.push("> 提示：mock 模式仅用于本地验证脚本可运行；真实差异请在生产服务器执行 `node scripts/schema-audit.mjs`。");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log(`[schema-audit] 扫描代码目录: ${SRC_DIR}`);
  const codeExpect = scanCode();
  console.log(`[schema-audit] 代码引用表 ${codeExpect.size} 张`);

  const ddlExpect = loadDdlExpectation();
  console.log(`[schema-audit] 迁移 DDL 期望表 ${ddlExpect.size} 张`);

  if (IS_MOCK) {
    console.log("[schema-audit] mock 模式：跳过数据库连接，仅输出代码期望结构");
    const md = renderMockReport(codeExpect, ddlExpect, {
      date: today(),
      mode: "mock",
      srcDir: SRC_DIR,
    });
    const reportPath = join(REPORTS_DIR, `schema-audit-${today()}.md`);
    await mkdir(REPORTS_DIR, { recursive: true });
    await writeFile(reportPath, md, "utf-8");
    console.log(`[schema-audit] 报告已生成: ${reportPath}`);
    console.log("--- 报告预览（前 30 行）---");
    console.log(md.split("\n").slice(0, 30).join("\n"));
    return;
  }

  console.log(`[schema-audit] 连接数据库 ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  const actual = await fetchActualSchema();
  console.log(`[schema-audit] 生产实际表 ${actual.size} 张`);

  const report = compare(codeExpect, ddlExpect, actual);
  const md = renderReport(report, {
    date: today(),
    mode: "production（information_schema 实际对比）",
    srcDir: SRC_DIR,
    dbHost: DB_CONFIG.host,
    dbPort: DB_CONFIG.port,
    dbName: DB_CONFIG.database,
  });
  const reportPath = join(REPORTS_DIR, `schema-audit-${today()}.md`);
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath, md, "utf-8");
  console.log(`[schema-audit] 报告已生成: ${reportPath}`);
}

main().catch((e) => {
  console.error("[schema-audit] 执行失败:", e.message);
  process.exit(1);
});
