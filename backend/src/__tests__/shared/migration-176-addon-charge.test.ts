import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix } from "../../shared/migration";

/**
 * R101-C4-1b 段一 回归保护：176 迁移文件（平台增值扣费流水 t_platform_addon_charge）的形状约束。
 *
 * 依据：
 * - 派单卡 §二.段一.2 + §三.4：只新增 1 张表、`IF NOT EXISTS`、零外键、语句在注释之前、零 ALTER、
 *   末行有跑后核对 SELECT；
 * - 踩坑日志 [63]：`runMigrations()` 第 8 步按 `;` 切块后会**丢弃**以 `--` 开头的整块语句 ⇒
 *   注释块必须整体位于末尾，可执行语句必须顶格在前；
 * - 踩坑日志（MIG-2）：`addTablePrefix` 早期版本遇反引号表名会把 `IF` 当表名（`CREATE TABLE t_IF`），
 *   导致 174/175 三张新表从未建成 ⇒ 本测试对 176 做同类反测。
 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "176_平台增值扣费流水.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

/** 复刻 runMigrations 第 8 步的切块逻辑（去掉 USE/DELIMITER 行 → 按 ; 切 → 丢弃空块与注释开头的块） */
function executableStatements(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toUpperCase();
      return !trimmed.startsWith("USE ") && !trimmed.startsWith("DELIMITER ");
    })
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("--"));
}

const statements = executableStatements(sql);
const migrated = statements.map((statement) => addTablePrefix(statement));

describe("176_平台增值扣费流水.sql 形状约束（踩坑[63] 不丢块）", () => {
  it("文件头是可执行语句（不是注释块），首条为 CREATE TABLE IF NOT EXISTS", () => {
    const firstLine = sql.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("CREATE TABLE")).toBe(true);
    expect(migrated[0]).toContain("CREATE TABLE IF NOT EXISTS t_platform_addon_charge (");
  });

  it("切块后只剩 2 条可执行语句：建表 + 跑后核对 SELECT（注释块不被误当语句）", () => {
    expect(statements).toHaveLength(2);
    expect(migrated[0]).toMatch(/^CREATE TABLE/);
    expect(migrated[1]).toContain("FROM information_schema.TABLES");
    expect(migrated[1]).toContain("t_platform_addon_charge");
  });

  it("只新增 1 张表，且零 ALTER / 零 DROP（不触碰任何既有表）", () => {
    const joined = migrated.join("\n");
    expect(joined.match(/CREATE TABLE/gi)).toHaveLength(1);
    expect(joined).not.toMatch(/ALTER\s+TABLE/i);
    expect(joined).not.toMatch(/DROP\s+TABLE/i);
  });

  it("零外键（无 FOREIGN KEY / REFERENCES）", () => {
    const joined = migrated.join("\n");
    expect(joined).not.toMatch(/FOREIGN\s+KEY/i);
    expect(joined).not.toMatch(/REFERENCES/i);
  });

  it("不建同义表：可执行语句不涉及调用量日统计表 t_open_api_call_daily", () => {
    expect(migrated.join("\n")).not.toContain("t_open_api_call_daily");
  });

  it("列定义齐备：含 tenant_id / charge_no / item / unit_price / amount 与中文 COMMENT", () => {
    const create = migrated[0];
    expect(create).toContain("tenant_id");
    expect(create).toContain("charge_no");
    expect(create).toContain("item");
    expect(create).toContain("unit_price");
    expect(create).toContain("amount");
    expect(create).toContain("COMMENT '租户ID'");
    expect(create).toContain("COMMENT '扣费单号（shared/id.makeBizNo）'");
    // 每个列定义都带中文 COMMENT（表尾 ENGINE=... COMMENT= 也含 COMMENT，故按列计数下限断言）
    expect((create.match(/COMMENT '/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });

  it("MIG-2 反测：addTablePrefix 不改坏已带 t_ 前缀的表名（无 t_IF 误伤）", () => {
    const create = migrated[0];
    expect(create).not.toMatch(/t_IF\b/);
    expect(create).not.toContain("t_t_platform_addon_charge");
  });

  it("迁移编号唯一且为当前最高编号（176 只出现一次）", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    // 只统计「三位序号_描述.sql」形态；仓库另有 `20260720_*.sql`（日期式）命名，不参与序号比较
    const numbered = files
      .map((name) => (/^(\d{3})_/.exec(name) ?? [])[1])
      .filter((value): value is string => !!value)
      .map((value) => Number(value));
    expect(files.filter((name) => name.startsWith("176_"))).toEqual(["176_平台增值扣费流水.sql"]);
    // 交付时 176 为最高序号（证据见 docs/evidence/c4-1b/段一-门禁证据-20260924.log）；
    // 用 >= 而非 === ，避免后续任务新增 177+ 迁移时把本条误判为回归
    expect(Math.max(...numbered)).toBeGreaterThanOrEqual(176);
  });
});
