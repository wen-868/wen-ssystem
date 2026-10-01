/**
 * S3-149 等价单测复跑（vitest 在沙箱内起不来：esbuild spawn EPERM，见 unit-equiv-output.txt 尾部）。
 * 口径与 backend/src/__tests__/shared/migration-split.test.ts 的「S3-51 修复守门」一致（同源函数），
 * 另加 S3-149 新断言：init_database.sql 经同源切分后的 CREATE TABLE 条数 = 62。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.S3144_SCRATCH;
const { splitSqlStatements } = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);

let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`); };

// —— 复刻 migration-split.test.ts「S3-51 修复守门」6 条 ——
let r = splitSqlStatements(`-- 编号: 031 订阅表\nCREATE TABLE IF NOT EXISTS t_subscription (\n  id INT PRIMARY KEY\n);`);
check("前导注释 + CREATE TABLE 保留", r.some(s => s.includes("CREATE TABLE") && s.includes("t_subscription")));
check("纯注释块返回空数组", splitSqlStatements(`-- 仅注释\n-- 第二行注释`).length === 0);
r = splitSqlStatements(`CREATE TABLE t_y (id INT COMMENT 'a--b');`);
check("语句中间 -- 不截断", r.some(s => s.includes("COMMENT 'a--b'")));
r = splitSqlStatements(`-- 说明\nCREATE TABLE t_x (id INT);\nSELECT 1 -- 行内注释`);
check("行内注释原样保留", r.some(s => s.includes("CREATE TABLE t_x")) && r.some(s => s.includes("SELECT 1") && s.includes("-- 行内注释")));
{
  const cleaned = `USE liquor_inventory;\nDELIMITER $$\nCREATE TABLE t_z (id INT);\nDELIMITER ;`
    .split("\n").filter(l => { const t = l.trim().toUpperCase(); return !t.startsWith("USE ") && !t.startsWith("DELIMITER "); }).join("\n");
  r = splitSqlStatements(cleaned);
  check("USE/DELIMITER 行被剔除", !r.some(s => s.toUpperCase().startsWith("USE ")) && !r.some(s => s.toUpperCase().startsWith("DELIMITER ")) && r.some(s => s.includes("CREATE TABLE t_z")));
}
r = splitSqlStatements(`CREATE TABLE t_a (id INT);\nCREATE PROCEDURE p_x() BEGIN END;\nDROP TABLE IF EXISTS t_b;`);
check("过程/DROP 仍进入拆分结果", r.some(s => s.includes("CREATE PROCEDURE")) && r.some(s => s.includes("DROP TABLE")));

// —— S3-149 新断言：与 migration.ts 第 1.5 步同源的预处理 + 过滤 ——
let initSql = readFileSync(join(process.cwd(), "docs", "init_database.sql"), "utf8");
initSql = initSql.replace(/CREATE\s+DATABASE[^;]+;/gi, "").replace(/USE\s+\w+;/gi, "")
  .replace(/SET\s+FOREIGN_KEY_CHECKS[^;]+;/gi, "").replace(/SET\s+NAMES[^;]+;/gi, "");
const stmts = splitSqlStatements(initSql).filter(s => /^CREATE\s+TABLE\b/i.test(s));
check("init_database.sql 解析出 CREATE TABLE 条数 = 62（旧写法为 0）", stmts.length === 62, `statements.length=${stmts.length}`);
const old = initSql.split(";").map(s => s.trim()).filter(s => s.length > 0 && s.toUpperCase().startsWith("CREATE TABLE"));
check("旧写法（反测）复现 0 条", old.length === 0, `old.length=${old.length}`);

console.log(`EQUIV_SUMMARY failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
