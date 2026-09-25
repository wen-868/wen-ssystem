import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements } from "../../shared/migration";

/**
 * R101-C6-1A + S3-110 回归保护：178 迁移文件（INSTANT 追加 6 列）的形状约束。
 *
 * 依据：
 * - 派单卡《R101-派单-20260925-C6-1A》交付物② + 红线②：新增 INSTANT 加列迁移必须幂等、
 *   可重复执行，且不得改既有迁移文件；
 * - 清账卡《R101-C6-0-阿坚清账》四.4：C1（t_library_brand 三列）与 C2（t_app_version 三列）
 *   初版按该建议"同表合并为一条 ALTER"，显式 ALGORITHM=INSTANT；
 * - 派单卡《R101-派单-20260925-S3-110》交付物③（+ 凌舟裁定 三 S3-110）：MySQL 是**语句级**原子，
 *   合并写法一旦有任一列已存在即整条 1060 被 safeExec 跳过、其余列补不上 ⇒ 改为**每列一条 ALTER**。
 *   本文件的形状断言随之由"2 条 ALTER（各 3 列）"改为"6 条 ALTER（各 1 列）"，并新增
 *   "任何一条 ALTER 不得含 2 个及以上 ADD COLUMN"的约束断言（防止退回全有全无写法）。
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

/** 取"给指定表加指定列"的那条 ALTER（逐列拆分后一列一条，故唯一） */
function alterFor(table: string, column: string) {
  return migrated.find(
    (statement) =>
      statement.includes(`ALTER TABLE ${table}`) && statement.includes(`ADD COLUMN ${column}`)
  );
}

const alterStatements = migrated.filter((statement) => /^ALTER TABLE/.test(statement));

describe("178_library_brand_auth_app_version_status.sql 形状约束", () => {
  it("文件头是可执行语句（不是注释块），首条为 t_library_brand 的 ALTER TABLE", () => {
    const firstLine = sql.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("ALTER TABLE")).toBe(true);
    expect(migrated[0]).toContain("ALTER TABLE t_library_brand");
  });

  it("切块后共 8 条可执行语句：6 条逐列 ALTER + 2 条跑后核对 SELECT", () => {
    expect(statements).toHaveLength(8);
    expect(alterStatements).toHaveLength(6);
    expect(migrated[6]).toContain("FROM information_schema.COLUMNS");
    expect(migrated[7]).toContain("COLUMN_COMMENT");
  });

  it("S3-110 ③：每条 ALTER 只加一列（禁止退回「同表多列合并」的全有全无写法）", () => {
    for (const statement of alterStatements) {
      expect(statement.match(/ADD COLUMN/gi) ?? []).toHaveLength(1);
    }
    // 6 列 ⇒ 6 条语句，且两表各 3 条
    expect(joined.match(/ADD COLUMN/gi) ?? []).toHaveLength(6);
    expect(alterStatements.filter((s) => s.includes("ALTER TABLE t_library_brand"))).toHaveLength(3);
    expect(alterStatements.filter((s) => s.includes("ALTER TABLE t_app_version"))).toHaveLength(3);
  });

  it("6 条 ALTER 均显式 ALGORITHM=INSTANT（仅加列、不动行格式）", () => {
    for (const statement of alterStatements) {
      expect(statement).toMatch(/ALGORITHM\s*=\s*INSTANT/);
    }
    expect((joined.match(/ALGORITHM\s*=\s*INSTANT/gi) ?? []).length).toBe(6);
  });

  it("C1：t_library_brand 追加 auth_letter_url / auth_expired_at / auth_status 三列（类型与清账卡一致）", () => {
    const letterUrl = alterFor("t_library_brand", "auth_letter_url");
    const expiredAt = alterFor("t_library_brand", "auth_expired_at");
    const authStatus = alterFor("t_library_brand", "auth_status");
    expect(letterUrl).toContain("ADD COLUMN auth_letter_url VARCHAR(512)");
    expect(expiredAt).toContain("ADD COLUMN auth_expired_at DATETIME");
    expect(authStatus).toContain("ADD COLUMN auth_status VARCHAR(16)");
    // 未上传/未设置必须可区分于空串与 0
    for (const statement of [letterUrl, expiredAt, authStatus]) {
      expect(statement).toContain("DEFAULT NULL");
    }
  });

  it("C2：t_app_version 追加 status / gray_ratio / archived_at 三列（status 默认 PUBLISHED，历史行语义显式化）", () => {
    const status = alterFor("t_app_version", "status");
    const grayRatio = alterFor("t_app_version", "gray_ratio");
    const archivedAt = alterFor("t_app_version", "archived_at");
    expect(status).toContain("ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED'");
    expect(grayRatio).toContain("ADD COLUMN gray_ratio TINYINT NOT NULL DEFAULT 0");
    expect(archivedAt).toContain("ADD COLUMN archived_at DATETIME");
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

  it("迁移编号唯一且单调不减（当前最高编号由文件集派生）", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("178_"))).toEqual([
      "178_library_brand_auth_app_version_status.sql",
    ]);
    const numbered = files
      .map((name) => (/^(\d{3})_/.exec(name) ?? [])[1])
      .filter((value): value is string => !!value)
      .map((value) => Number(value));
    // 最高编号由文件集派生：原写法 `expect(Math.max(...numbered)).toBe(178)` 恒等于 178，
    // 新增任何 ≥179 的迁移都会必然判红（churn 型门禁），故改为断言不变量本身。
    const max = Math.max(...numbered);
    // 单调不减：编号不得回退到 178 以前
    expect(max).toBeGreaterThanOrEqual(178);
    // 最高编号唯一
    expect(numbered.filter((value) => value === max)).toHaveLength(1);
    // 全量编号唯一：同一编号只能对应 1 个文件（防重复编号）。
    // 存量例外：126 / 127 / 137 / 154 各自对应 2 个文件，属本门禁建立之前的历史重复编号
    // （重命名既有迁移不在本单授权范围内），此处仅放行这 4 个存量编号，**新增重复一律判红**。
    const legacyDuplicateNumbers = [126, 127, 137, 154];
    const duplicated = numbered.filter((value, index) => numbered.indexOf(value) !== index);
    expect(duplicated.filter((value) => !legacyDuplicateNumbers.includes(value))).toEqual([]);
  });
});
