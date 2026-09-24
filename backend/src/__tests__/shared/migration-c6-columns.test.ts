import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements } from "../../shared/migration";

/**
 * R101-C6-1A 回归保护：178 迁移文件（INSTANT 追加 6 列）的形状约束。
 *
 * 依据：
 * - 派单卡《R101-派单-20260925-C6-1A》交付物② + 红线②：新增 INSTANT 加列迁移必须幂等、
 *   可重复执行，且不得改既有迁移文件；
 * - 清账卡《R101-C6-0-阿坚清账》四.4：C1（t_library_brand 三列）与 C2（t_app_version 三列）
 *   同表合并为一条 ALTER，显式 ALGORITHM=INSTANT；
 * - 踩坑日志 [63]／MIG-1：以 `--` 开头的整块语句会被 runner 丢弃 ⇒ 语句顶格、注释块在末尾；
 * - MIG-2：`addTablePrefix` 对反引号表名有早期缺陷 ⇒ 不使用反引号。
 *
 * 说明：切块与加前缀直接复用生产代码（`splitSqlStatements` / `addTablePrefix`），
 * 与运行时第 8 步同管线，不另写复刻逻辑。
 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "178_library_brand_auth_app_version_status.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

const cleaned = sql
  .split("\n")
  .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
  .join("\n");

const statements = splitSqlStatements(cleaned);
const migrated = statements.map((statement) => addTablePrefix(statement));
const joined = migrated.join("\n");

describe("178_library_brand_auth_app_version_status.sql 形状约束", () => {
  it("文件头是可执行语句（不是注释块），首条为 t_library_brand 的 ALTER TABLE", () => {
    const firstLine = sql.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("ALTER TABLE")).toBe(true);
    expect(migrated[0]).toContain("ALTER TABLE t_library_brand");
  });

  it("切块后只剩 4 条可执行语句：2 条 ALTER + 2 条跑后核对 SELECT", () => {
    expect(statements).toHaveLength(4);
    expect(migrated[0]).toMatch(/^ALTER TABLE/);
    expect(migrated[1]).toMatch(/^ALTER TABLE t_app_version/);
    expect(migrated[2]).toContain("FROM information_schema.COLUMNS");
    expect(migrated[3]).toContain("COLUMN_COMMENT");
  });

  it("两条 ALTER 均显式 ALGORITHM=INSTANT（仅加列、不动行格式）", () => {
    expect(migrated[0]).toMatch(/ALGORITHM\s*=\s*INSTANT/);
    expect(migrated[1]).toMatch(/ALGORITHM\s*=\s*INSTANT/);
    expect((joined.match(/ALGORITHM\s*=\s*INSTANT/gi) ?? []).length).toBe(2);
  });

  it("C1：t_library_brand 追加 auth_letter_url / auth_expired_at / auth_status 三列（类型与清账卡一致）", () => {
    const alter = migrated[0];
    expect(alter).toContain("ADD COLUMN auth_letter_url VARCHAR(512)");
    expect(alter).toContain("ADD COLUMN auth_expired_at DATETIME");
    expect(alter).toContain("ADD COLUMN auth_status VARCHAR(16)");
    expect((alter.match(/ADD COLUMN/gi) ?? []).length).toBe(3);
    // 未上传/未设置必须可区分于空串与 0
    expect(alter).toContain("DEFAULT NULL");
  });

  it("C2：t_app_version 追加 status / gray_ratio / archived_at 三列（status 默认 PUBLISHED，历史行语义显式化）", () => {
    const alter = migrated[1];
    expect(alter).toContain("ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED'");
    expect(alter).toContain("ADD COLUMN gray_ratio TINYINT NOT NULL DEFAULT 0");
    expect(alter).toContain("ADD COLUMN archived_at DATETIME");
    expect((alter.match(/ADD COLUMN/gi) ?? []).length).toBe(3);
  });

  it("只做追加：零改列、零删列、零新建表、零 DROP、零 DML（写闸门 block 下也能执行）", () => {
    expect(joined).not.toMatch(/MODIFY\s+COLUMN/i);
    expect(joined).not.toMatch(/CHANGE\s+COLUMN/i);
    expect(joined).not.toMatch(/DROP\s+COLUMN/i);
    expect(joined).not.toMatch(/DROP\s+TABLE/i);
    expect(joined).not.toMatch(/CREATE\s+TABLE/i);
    expect(joined).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE)\b/i);
  });

  it("不越界：不碰 t_library_spu.ai_confidence（清账卡 C3 未在本单派工范围内）", () => {
    expect(joined).not.toContain("t_library_spu");
    expect(joined).not.toContain("ai_confidence");
  });

  it("MIG-2 反测：不使用反引号包表名，addTablePrefix 不改坏已带 t_ 前缀的表名", () => {
    expect(joined).not.toContain("`");
    expect(joined).not.toContain("t_t_library_brand");
    expect(joined).not.toContain("t_t_app_version");
  });

  it("注释块全部位于可执行语句之后，且注释文字内无 ASCII 分号（踩坑 [63] 伪语句风险）", () => {
    const lines = sql.split(/\r?\n/);
    const firstCommentIndex = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutableIndex = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstCommentIndex).toBeGreaterThan(lastExecutableIndex);
    expect(lines.filter((line) => line.trim().startsWith("--")).join("\n")).not.toContain(";");
  });

  it("迁移编号唯一且为当前最高编号（178 只出现一次）", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("178_"))).toEqual([
      "178_library_brand_auth_app_version_status.sql",
    ]);
    const numbered = files
      .map((name) => (/^(\d{3})_/.exec(name) ?? [])[1])
      .filter((value): value is string => !!value)
      .map((value) => Number(value));
    expect(Math.max(...numbered)).toBe(178);
  });
});
