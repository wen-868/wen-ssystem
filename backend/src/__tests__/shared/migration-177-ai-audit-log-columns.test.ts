import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements } from "../../shared/migration";

/**
 * R101-C5-1 回归保护：177 迁移文件（`t_ai_audit_log` INSTANT 追加 cost / deduct_source 两列）的形状约束。
 *
 * 依据：
 * - 派单卡 §二：只做追加（零改既有列/零删列/零新建表）、必须显式 `ALGORITHM=INSTANT`、
 *   语句顶格放在注释之前、末附跑后核对 SELECT、不用反引号包表名；
 * - 踩坑日志 [63]／MIG-1：`runMigrations()` 第 8 步按 `;` 切块，**以 `--` 开头的整块**会被丢弃
 *   （注释块必须整体在末尾，注释文字内不得出现 ASCII 分号，否则后半段成为伪语句）；
 * - MIG-2：`addTablePrefix` 对反引号表名的早期缺陷（`CREATE TABLE t_IF`）⇒ 本文件不使用反引号。
 *
 * 说明：本测试直接使用生产代码里的 `splitSqlStatements`（不再手写复刻），切块逻辑与运行时一致。
 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "177_ai_audit_log_cost_deduct_source.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

const cleaned = sql
  .split("\n")
  .filter((line) => {
    const trimmed = line.trim().toUpperCase();
    return !trimmed.startsWith("USE ") && !trimmed.startsWith("DELIMITER ");
  })
  .join("\n");

/** 与 `runMigrations()` 第 8 步同管线：切块 → 丢弃空块 →（运行时）addTablePrefix */
const statements = splitSqlStatements(cleaned);
const migrated = statements.map((statement) => addTablePrefix(statement));
const joined = migrated.join("\n");

describe("177_ai_audit_log_cost_deduct_source.sql 形状约束", () => {
  it("文件头是可执行语句（不是注释块），首条为 ALTER TABLE", () => {
    const firstLine = sql.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("ALTER TABLE")).toBe(true);
    expect(migrated[0]).toContain("ALTER TABLE t_ai_audit_log");
  });

  it("切块后只剩 3 条可执行语句：ALTER + 2 条跑后核对 SELECT（注释块不被误当语句）", () => {
    expect(statements).toHaveLength(3);
    expect(migrated[0]).toMatch(/^ALTER TABLE/);
    expect(migrated[1]).toContain("FROM information_schema.COLUMNS");
    expect(migrated[1]).toContain("t_ai_audit_log");
    expect(migrated[2]).toContain("FROM information_schema.COLUMNS");
    expect(migrated[2]).toContain("COLUMN_COMMENT");
  });

  it("显式 ALGORITHM=INSTANT，且仅追加 cost / deduct_source 两列（类型与派单卡一致）", () => {
    const alter = migrated[0];
    expect(alter).toMatch(/ALGORITHM\s*=\s*INSTANT/);
    expect(alter).toContain("ADD COLUMN cost DECIMAL(12,4)");
    expect(alter).toContain("ADD COLUMN deduct_source VARCHAR(32)");
    expect((alter.match(/ADD COLUMN/gi) ?? []).length).toBe(2);
  });

  it("只做追加：零改列、零删列、零新建表、零 DROP、零 DML（写闸门 block 下也能执行）", () => {
    expect(joined).not.toMatch(/MODIFY\s+COLUMN/i);
    expect(joined).not.toMatch(/CHANGE\s+COLUMN/i);
    expect(joined).not.toMatch(/DROP\s+COLUMN/i);
    expect(joined).not.toMatch(/DROP\s+TABLE/i);
    expect(joined).not.toMatch(/CREATE\s+TABLE/i);
    expect(joined).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE)\b/i);
  });

  it("只触碰 t_ai_audit_log：不涉及日聚合表 t_ai_usage_daily 与外部模型表（不建同义表）", () => {
    expect(joined).toContain("t_ai_audit_log");
    expect(joined).not.toContain("t_ai_usage_daily");
    expect(joined).not.toContain("t_ai_external_model");
    expect(joined).not.toContain("t_platform_ai_config");
  });

  it("MIG-2 反测：不使用反引号包表名，addTablePrefix 不改坏已带 t_ 前缀的表名", () => {
    expect(joined).not.toContain("`");
    expect(joined).not.toContain("t_t_ai_audit_log");
    expect(joined).not.toMatch(/t_IF\b/);
    expect(migrated[0]).toContain("ALTER TABLE t_ai_audit_log");
  });

  it("注释块全部位于可执行语句之后，且注释文字内无 ASCII 分号（踩坑 [63] 伪语句风险）", () => {
    const lines = sql.split(/\r?\n/);
    const firstCommentIndex = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutableIndex = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstCommentIndex).toBeGreaterThan(lastExecutableIndex);

    const commentText = lines
      .filter((line) => line.trim().startsWith("--"))
      .join("\n");
    expect(commentText).not.toContain(";");
  });

  it("两列均可空默认 NULL（历史行不造 0）：含 NULL 语义与中文 COMMENT", () => {
    const alter = migrated[0];
    expect(alter).toContain("DEFAULT NULL");
    expect(alter).toContain("COMMENT '本次调用费用");
    expect(alter).toContain("COMMENT '扣减来源");
  });

  it("迁移编号唯一且为当前最高编号（177 只出现一次）", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("177_"))).toEqual([
      "177_ai_audit_log_cost_deduct_source.sql",
    ]);
    const numbered = files
      .map((name) => (/^(\d{3})_/.exec(name) ?? [])[1])
      .filter((value): value is string => !!value)
      .map((value) => Number(value));
    expect(Math.max(...numbered)).toBeGreaterThanOrEqual(177);
  });
});
