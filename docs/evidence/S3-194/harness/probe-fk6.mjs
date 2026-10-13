#!/usr/bin/env node
/**
 * S3-194 语句级探针：证明 016 的 t_tenant_admin 建表语句（第 6 条外键）在 MySQL 8 空库上能建成，
 * 并证明它随后是被**既有 169 迁移**（DROP FOREIGN KEY）移除的，而不是本单删的。
 *
 * 用法：node probe-fk6.mjs <repo> <mysqlBinDir> <port> <probeDb> <outFile>
 *
 * 步骤：
 *   1) 在探针库按 runner 第 1 步的实际产物形状建 t_tenant（DDL 取自修复后真库的 SHOW CREATE TABLE）
 *   2) 取 016 的 t_tenant_admin 建表块，经 **runner 自己的 addTablePrefix()** 改写后执行
 *   3) 打印 information_schema 外键行 + SHOW CREATE TABLE 片段（证明第 6 条外键真实建成）
 *   4) 执行 169 的 `DROP FOREIGN KEY`（原样语句），再打印一次（证明"最终 5 条"来自既有 169 口径）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const [repo, mysqlBin, port, probeDb, outFile, srcDb] = process.argv.slice(2);
// 装置在仓库外运行 ⇒ 用仓库根的解析器拿 mysql2（与仓库内测试同一份依赖）
const mysql = createRequire(join(repo, "package.json"))("mysql2/promise");
const { addTablePrefix } = await import(`file://${join(repo, "backend/dist/shared/migration.js").replace(/\\/g, "/")}`);

/** 从 016 抽 t_tenant_admin 的建表块（到第一个分号为止） */
function extractBlock(sql, table) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  if (start < 0) throw new Error(`未找到 ${table} 建表块`);
  const end = sql.indexOf(";", start);
  return sql.slice(start, end + 1);
}

const sql016 = readFileSync(join(repo, "docs/migrations/016_phase9_tenant_subscription.sql"), "utf8");
const rawBlock = extractBlock(sql016, "t_tenant_admin");
const prefixed = addTablePrefix(rawBlock);

const conn = await mysql.createConnection({ host: "127.0.0.1", port: Number(port), user: "root", password: "", multipleStatements: true });
const out = [];
const log = (s) => { out.push(s); console.log(s); };

await conn.query(`DROP DATABASE IF EXISTS ${probeDb}; CREATE DATABASE ${probeDb}; USE ${probeDb};`);

// 1) t_tenant：形状取自修复后真库（runner 第 1 步的实际产物）
const src = await mysql.createConnection({ host: "127.0.0.1", port: Number(port), user: "root", password: "", database: srcDb });
const [rows] = await src.query("SHOW CREATE TABLE t_tenant");
const tenantDdl = rows[0]["Create Table"].replace(/^CREATE TABLE `t_tenant`/, "CREATE TABLE t_tenant");
await src.end();
await conn.query(tenantDdl);
log("[步骤1] 探针库已建 t_tenant（形状取自修复后真库的 SHOW CREATE TABLE）");

// 2) 经 addTablePrefix 改写后的 016 语句原文 + 执行
log("[步骤2] 016 的 t_tenant_admin 语句（经 runner addTablePrefix 改写后）首行：");
log("        " + prefixed.split("\n")[0]);
log("        " + prefixed.split("\n").find((l) => l.includes("FOREIGN KEY")).trim());
await conn.query(prefixed);
log("[步骤2] 执行成功（无 errno 3780）");

// 3) 外键存在性
const [fkRows] = await conn.query(
  `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_tenant_admin' AND REFERENCED_TABLE_NAME IS NOT NULL`,
  [probeDb]
);
log(`[步骤3] information_schema 外键行数 = ${fkRows.length}`);
for (const r of fkRows) log(`        ${r.CONSTRAINT_NAME}: ${r.COLUMN_NAME} → ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`);
const [sc] = await conn.query("SHOW CREATE TABLE t_tenant_admin");
const fkLine = sc[0]["Create Table"].split("\n").find((l) => l.includes("CONSTRAINT"));
log(`[步骤3] SHOW CREATE TABLE 外键行：${fkLine ? fkLine.trim() : "（无）"}`);

// 4) 执行既有 169 的 DROP FOREIGN KEY
await conn.query("ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1");
const [fkRows2] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_tenant_admin' AND REFERENCED_TABLE_NAME IS NOT NULL`,
  [probeDb]
);
log(`[步骤4] 执行既有 169 的 DROP FOREIGN KEY 后，外键行数 = ${fkRows2[0].c}（⇒ 第 6 条外键是被既有 169 迁移按既有口径移除的，非本单删除）`);
log(`[步骤4] 探针库列定义：tenant_id 类型 = ${(await conn.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_tenant_admin' AND COLUMN_NAME='tenant_id'", [probeDb]))[0][0].COLUMN_TYPE}`);

await conn.query(`DROP DATABASE ${probeDb};`);
await conn.end();
writeFileSync(outFile, out.join("\n"), "utf8");
console.log(`\n[写出] ${outFile}`);
