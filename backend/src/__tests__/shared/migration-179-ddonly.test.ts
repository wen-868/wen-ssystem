/**
 * C6-2-T6-F2 防回归：迁移 179 必须保持"纯 DDL"——文件里不得出现任何数据写语句。
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T6-F2.md
 *   - 交付物①：迁移 179 回归纯 DDL（删除预置 INSERT），只留 3 条 CREATE TABLE + 3 条跑后核对 SELECT；
 *   - 交付物③：新增防回归断言——读该迁移文件，断言不含任何 INSERT/UPDATE/DELETE/REPLACE 语句；
 *   - §四.8：必须用**与 runner 同源**的 `splitSqlStatements` / `isDataWriteStatement` 判定，
 *     不得自写正则复刻（否则断言与 runner 会各自漂移，出现"门禁绿但 runner 照跑写语句"的假门禁）。
 *
 * 为什么这条断言重要：MIG-4 写闸门默认 block（`resolveWriteGate()` 只认环境变量 MIGRATION_WRITE_GATE，
 * 未设置/非法值一律 block），而 `runMigrations()` 由 server.ts 每次启动调用、全仓无执行账本表
 * ⇒ 迁移里的预置写语句既不会落库，放行 allow 又会随每次重启复利叠加。目录的单一真相源是
 * 后端代码常量 PERMISSION_CATALOG（见 platform-role.service.ts），故迁移必须零写语句。
 *
 * 反测：往 179 临时加回任意一条 INSERT ⇒ 本文件第一个用例必红（见回传卡的原始输出）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  splitSqlStatements,
  firstKeyword,
  isDataWriteStatement,
} from "../../shared/migration";

/** 路径写法照 178 用例（migration-c6-columns.test.ts）的既有惯例 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "179_平台角色与权限点目录.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");
const statements = splitSqlStatements(sql);
const keywords = statements.map((statement) => firstKeyword(statement));

describe("179_平台角色与权限点目录.sql 纯 DDL 约束（C6-2-T6-F2）", () => {
  it("零数据写语句（反测：加回一条 INSERT ⇒ 本断言必红）", () => {
    const writes = statements.filter((statement) => isDataWriteStatement(statement));
    expect(writes).toEqual([]);
    // 双保险：首关键字层面也不得出现写语句/CALL（与 runner 的 DATA_WRITE_KEYWORDS 同集）
    expect(keywords.filter((k) => ["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"].includes(k))).toEqual([]);
    // 全文直查（注释里不得出现会被验收 rg 命中的"行首写语句关键字"）
    expect(sql.split(/\r?\n/).filter((line) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/.test(line))).toEqual([]);
  });

  it("三张表仍由 3 条 CREATE TABLE IF NOT EXISTS 建成（迁移主体未被削弱）", () => {
    const creates = statements.filter((statement) => firstKeyword(statement) === "CREATE");
    expect(creates).toHaveLength(3);
    for (const table of [
      "t_platform_role",
      "t_platform_role_permission",
      "t_platform_permission_catalog",
    ]) {
      // 用"表名 + 左括号"精确匹配，避免 t_platform_role 命中 t_platform_role_permission 的前缀
      const pattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`);
      expect(creates.filter((s) => pattern.test(s))).toHaveLength(1);
    }
  });

  it("3 条跑后核对 SELECT 保留（含对目录表的 GROUP BY 统计：空表恒 0 行，作「迁移不写数据」旁证）", () => {
    const selects = statements.filter((statement) => firstKeyword(statement) === "SELECT");
    expect(selects).toHaveLength(3);
    expect(selects.filter((s) => s.includes("information_schema.TABLES"))).toHaveLength(1);
    expect(selects.filter((s) => s.includes("GROUP BY module_code, perm_level"))).toHaveLength(1);
    expect(selects.filter((s) => s.includes("information_schema.COLUMNS"))).toHaveLength(1);
  });

  it("文件头注释写明「目录数据不在迁移里写」且指向代码常量，注释块位于末条可执行语句之后", () => {
    expect(sql).toContain("目录数据不在迁移里写");
    expect(sql).toContain("PERMISSION_CATALOG");
    expect(sql).toContain("纯 DDL 无预置数据");

    // 踩坑日志 [63]／MIG-1：注释块必须在可执行语句之后，否则整块语句会被 runner 丢弃
    const lines = sql.split(/\r?\n/);
    const firstComment = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutable = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstComment).toBeGreaterThan(lastExecutable);
    // 注释行内不得出现 ASCII 分号（会把注释块切成两半，178 迁移同规）
    expect(lines.filter((line) => line.trim().startsWith("--")).join("\n")).not.toContain(";");
  });
});
