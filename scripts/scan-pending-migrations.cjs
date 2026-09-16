#!/usr/bin/env node
/**
 * scan-pending-migrations.cjs
 * ---------------------------------------------------------------------------
 * S3-51 发布准备：可复跑的「修复后 runner 将首次执行、旧逻辑丢弃」语句块扫描器。
 *
 * 用途：复刻修复后 backend/src/shared/migration.ts 的 runner 逻辑
 *   （cleanSql 去 USE/DELIMITER → splitSqlStatements 剥离块开头整行注释 →
 *    跳过 CREATE/DROP PROCEDURE 与 DROP TABLE → addTablePrefix 加 t_ 前缀 → safeExec）
 * 静态扫描 docs/migrations/*.sql，产出「旧逻辑丢弃、新逻辑会执行」的语句块清单。
 *
 * 它【不连接、不执行】任何数据库，纯静态文本分析。
 *
 * 何时重跑：下次改动 migration.ts 的 splitSqlStatements / addTablePrefix / 跳过规则，
 *   或新增/修改迁移文件后，重跑本脚本复核清单是否变化：
 *      node scripts/scan-pending-migrations.cjs
 *   可选参数：--json out.json  仅写 JSON；默认同时打印统计到 stdout。
 *
 * 注意：本脚本内嵌的是「修复后」的 runner 逻辑（与 origin/fix/s3-52-references 一致）。
 *   若 migration.ts 再次变更，请同步更新本文件中的 splitSqlStatements / addTablePrefix /
 *   TABLE_NAME_PATTERNS / 跳过规则，否则清单会与真实 runner 漂移。
 * ---------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const MIG_DIR = path.join(__dirname, "..", "docs", "migrations");
const OUT_JSON = path.join(__dirname, "..", "scan-pending-output.json");

// ===== 复刻 addTablePrefix（与修复后 migration.ts 一致）=====
const TABLE_NAME_PATTERNS = [
  { name: "CREATE_TABLE",     regex: /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([`a-z_][`a-z0-9_]*)/gi },
  { name: "ALTER_TABLE",      regex: /(ALTER\s+TABLE\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "INSERT_INTO",      regex: /(INSERT\s+(?:IGNORE\s+)?INTO\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "UPDATE",           regex: /((?:^|\n)\s*UPDATE\s+)([`a-z_][`a-z0-9_]*)/gim },
  { name: "DELETE_FROM",      regex: /(DELETE\s+FROM\s+)([`a-z_][a-z0-9_]*)/gi },
  { name: "FROM",             regex: /(\bFROM\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "JOIN",             regex: /(\b(?:LEFT|RIGHT|INNER|OUTER|FULL|CROSS\s+)?JOIN\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "INTO",             regex: /(\bINTO\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "REFERENCES",       regex: /(REFERENCES\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "CREATE_INDEX_ON",  regex: /(CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s+[`a-z_][`a-z0-9_]*\s+ON\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "RENAME_TABLE",     regex: /(RENAME\s+TABLE\s+)([`a-z_][`a-z0-9_]*)/gi },
  { name: "DROP_TABLE",       regex: /(DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?)([`a-z_][`a-z0-9_]*)/gi },
];

function addTablePrefix(sql) {
  let result = sql;
  for (const { regex } of TABLE_NAME_PATTERNS) {
    result = result.replace(regex, (match, prefix, tableName) => {
      const bare = tableName.replace(/`/g, "");
      if (bare.startsWith("t_") || bare.startsWith("information_schema") || bare.startsWith("mysql")) {
        return match;
      }
      if (tableName.startsWith("`")) {
        return `${prefix}\`t_${bare}\``;
      }
      return prefix + "t_" + bare;
    });
  }
  return result;
}

// ===== 复刻 splitSqlStatements（修复后）=====
function splitSqlStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .map((s) => s.replace(/^(\s*--[^\n]*(\n|$))+/, "").trim())
    .filter((s) => s.length > 0);
}

function cleanSql(sql) {
  return sql
    .split("\n")
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
    })
    .join("\n");
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function classify(stripped) {
  const c = stripSqlComments(stripped);
  if (/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(c)) return { type: "CREATE TABLE IF NOT EXISTS", idem: "幂等", risk: "低" };
  if (/^\s*CREATE\s+TABLE\b/i.test(c)) return { type: "CREATE TABLE", idem: "会报错但无害", risk: "低" };
  if (/^\s*CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s/i.test(c)) {
    if (/IF\s+NOT\s+EXISTS/i.test(c)) return { type: "CREATE INDEX IF NOT EXISTS", idem: "幂等", risk: "低" };
    return { type: "CREATE INDEX", idem: "会报错但无害", risk: "低" };
  }
  if (/^\s*ALTER\s+TABLE/i.test(c)) {
    if (/\bMODIFY\b|\bCHANGE\b/i.test(c) && /COLLATE/i.test(c)) return { type: "ALTER TABLE MODIFY COLLATE", idem: "不可逆", risk: "需凌舟单独批准" };
    if (/DROP\s+COLUMN/i.test(c)) return { type: "ALTER TABLE DROP COLUMN", idem: "不可逆", risk: "需凌舟单独批准" };
    if (/\bMODIFY\b|\bCHANGE\b/i.test(c)) return { type: "ALTER TABLE MODIFY/CHANGE", idem: "不可逆", risk: "需凌舟单独批准" };
    if (/ALTER\s+COLUMN[^;]*SET\s+DEFAULT/i.test(c)) return { type: "ALTER TABLE SET DEFAULT", idem: "幂等", risk: "低" };
    if (/ADD\s+(COLUMN\s+)?[`\w]+/i.test(c)) {
      if (/IF\s+NOT\s+EXISTS/i.test(c)) return { type: "ALTER TABLE ADD COLUMN IF NOT EXISTS", idem: "幂等", risk: "低" };
      return { type: "ALTER TABLE ADD COLUMN", idem: "会报错但无害", risk: "低" };
    }
    if (/ADD\s+(INDEX|KEY|UNIQUE)/i.test(c)) {
      if (/IF\s+NOT\s+EXISTS/i.test(c)) return { type: "ALTER TABLE ADD INDEX", idem: "幂等", risk: "低" };
      return { type: "ALTER TABLE ADD INDEX", idem: "会报错但无害", risk: "低" };
    }
    return { type: "ALTER TABLE", idem: "不可逆", risk: "需凌舟单独批准" };
  }
  if (/^\s*INSERT\s+IGNORE/i.test(c)) return { type: "INSERT IGNORE", idem: "幂等", risk: "低" };
  if (/^\s*INSERT\b/i.test(c)) return { type: "INSERT", idem: "数据变更", risk: "中" };
  if (/^\s*UPDATE\b/i.test(c)) return { type: "UPDATE", idem: "数据变更", risk: "需凌舟单独批准" };
  if (/^\s*DELETE\b/i.test(c)) return { type: "DELETE", idem: "数据变更", risk: "高" };
  if (/^\s*REPLACE\b/i.test(c)) return { type: "REPLACE INTO", idem: "数据变更", risk: "中" };
  if (/^\s*DROP\b/i.test(c)) return { type: "DROP", idem: "不可逆", risk: "需凌舟单独批准" };
  if (/^\s*CREATE\s+VIEW/i.test(c)) return { type: "CREATE VIEW", idem: "会报错但无害", risk: "低" };
  if (/^\s*CREATE\s+DATABASE/i.test(c)) return { type: "CREATE DATABASE IF NOT EXISTS", idem: "幂等", risk: "低" };
  if (/^\s*SET\b/i.test(c)) return { type: "SET 会话变量/开关", idem: "幂等", risk: "低" };
  if (/^\s*SELECT\b/i.test(c)) return { type: "SELECT 只读校验", idem: "幂等", risk: "低" };
  if (/^\s*CALL\b/i.test(c)) return { type: "CALL 存储过程", idem: "会报错但无害", risk: "低" };
  return { type: "OTHER", idem: "数据变更", risk: "中" };
}

function getPrimaryTable(finalSql) {
  const order = [
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)`?([a-z_][a-z0-9_]*)/i,
    /(ALTER\s+TABLE\s+)`?([a-z_][a-z0-9_]*)/i,
    /(INSERT\s+(?:IGNORE\s+)?INTO\s+)`?([a-z_][a-z0-9_]*)/i,
    /(?:^|\n|\s)UPDATE\s+`?([a-z_][a-z0-9_]*)/i,
    /(DELETE\s+FROM\s+)`?([a-z_][a-z0-9_]*)/i,
    /(DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?)`?([a-z_][a-z0-9_]*)/i,
    /(RENAME\s+TABLE\s+)`?([a-z_][a-z0-9_]*)/i,
  ];
  for (const re of order) {
    const m = finalSql.match(re);
    if (m) return (m[2] || m[1] || "").replace(/`/g, "");
  }
  return "";
}

// ===== 主流程：扫描本地 docs/migrations =====
function main() {
  if (!fs.existsSync(MIG_DIR)) {
    console.error(`迁移目录不存在: ${MIG_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
    .sort();

  const out = [];
  const stats = { totalFiles: files.length, rawNewOnly: 0, executedNewOnly: 0, skippedDueToProcOrDrop: 0, firstBlockCommentWithStmt: 0 };

  for (const file of files) {
    const content = fs.readFileSync(path.join(MIG_DIR, file), "utf-8");
    const cleaned = cleanSql(content);
    const rawBlocks = cleaned.split(";").map((s) => s.trim());

    const pairs = rawBlocks.map((b) => ({
      orig: b,
      stripped: b.replace(/^(\s*--[^\n]*(\n|$))+/, "").trim(),
    }));

    if (rawBlocks[0] && rawBlocks[0].length > 0 && rawBlocks[0].startsWith("--")) {
      const s0 = rawBlocks[0].replace(/^(\s*--[^\n]*(\n|$))+/, "").trim();
      if (s0.length > 0) stats.firstBlockCommentWithStmt++;
    }

    pairs.forEach((p, idx) => {
      if (p.orig.length > 0 && p.orig.startsWith("--") && p.stripped.length > 0) {
        stats.rawNewOnly++;
        const isProc = p.stripped.includes("CREATE PROCEDURE") || p.stripped.includes("DROP PROCEDURE");
        const isDrop = /DROP\s+TABLE/i.test(p.stripped);
        if (isProc || isDrop) { stats.skippedDueToProcOrDrop++; return; }
        stats.executedNewOnly++;
        const finalSql = addTablePrefix(p.stripped);
        const cls = classify(p.stripped);
        out.push({
          file, blockIndex: idx, isFirstBlock: idx === 0,
          type: cls.type, idem: cls.idem, risk: cls.risk,
          targetTable: getPrimaryTable(finalSql),
          finalSql: finalSql.length > 200 ? finalSql.slice(0, 200) + " …(截断)" : finalSql,
        });
      }
    });
  }

  const idemCount = {};
  for (const b of out) idemCount[b.idem] = (idemCount[b.idem] || 0) + 1;

  fs.writeFileSync(OUT_JSON, JSON.stringify({ stats, idemCount, blocks: out }, null, 2), "utf8");
  console.log("扫描目录:", MIG_DIR);
  console.log("统计:", JSON.stringify(stats));
  console.log("幂等档分布:", JSON.stringify(idemCount));
  console.log("输出 ->", OUT_JSON);
}

main();
