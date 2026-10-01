/**
 * R101-C6-3-2b 迁移形状约束：195（t_referral_ledger 老带新台账）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2b.md §三（逐列口径 + uk_invitee 硬约束）
 *   · CREATE TABLE IF NOT EXISTS + 文本列**显式** COLLATE utf8mb4_0900_ai_ci + 零预置 + 不建物理外键
 *   · 可执行语句顶格写在注释块之前（规避踩坑日志 [63]：以注释开头的整块语句会被 runner 丢弃）
 *   · 注释文字内不得出现 ASCII 分号（否则注释块会被 splitSqlStatements 切成两半）
 * 切块与加前缀直接复用生产代码（splitSqlStatements / addTablePrefix），与运行时第 8 步同管线。
 *
 * 说明（沙箱无库）：本文件是"迁移形状 + 管线存活"的等价装置，证明本单唯一一条 DDL 会被 runner
 * 完整保留并执行；真库建成证据由 CI `migration-check`（真实 MySQL 8 上重启后端触发
 * `docs/migrations/**`）与本卡回传的其它读数共同承担。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements } from "../../shared/migration";

const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");

/** 归一 CRLF：本仓 core.autocrlf=true，工作区检出为 CRLF（踩坑 [153]/S3-133-F1） */
function readSql(file: string) {
  const abs = resolve(MIGRATIONS_DIR, file);
  expect(existsSync(abs), `缺少迁移文件 ${file}`).toBe(true);
  const raw = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  const statements = splitSqlStatements(cleaned);
  return {
    raw,
    statements,
    migrated: statements.map((s) => addTablePrefix(s)),
    joined: statements.map((s) => addTablePrefix(s)).join("\n"),
  };
}

const FILE_195 = "195_老带新台账.sql";
const TABLE = "t_referral_ledger";
const mig195 = readSql(FILE_195);

describe(`迁移 ${FILE_195} 形状约束`, () => {
  it("文件头是可执行语句（不是注释块），首条为 CREATE TABLE IF NOT EXISTS", () => {
    const firstLine = mig195.raw.split("\n").find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("CREATE TABLE IF NOT EXISTS")).toBe(true);
    expect(mig195.statements[0]).toContain(`CREATE TABLE IF NOT EXISTS ${TABLE}`);
  });

  it("切块后共 5 条可执行语句：1 条 CREATE TABLE + 4 条跑后核对 SELECT", () => {
    expect(mig195.statements).toHaveLength(5);
    const selects = mig195.migrated.filter((s) => /^SELECT/.test(s));
    expect(selects).toHaveLength(4);
    expect(mig195.migrated.filter((s) => s.includes("FROM information_schema")).length).toBeGreaterThanOrEqual(3);
  });

  it("零预置数据：无 INSERT / UPDATE / DELETE / REPLACE / CALL（写闸门 block 下也能整篇执行）", () => {
    for (const statement of mig195.statements) {
      expect(statement).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|REPLACE|CALL)\b/i);
    }
  });

  it("不建物理外键、不建反引号、不 DROP、不 ALTER 既有表", () => {
    expect(mig195.joined).not.toMatch(/FOREIGN\s+KEY/i);
    expect(mig195.joined).not.toMatch(/REFERENCES/i);
    expect(mig195.joined).not.toContain("`");
    expect(mig195.joined).not.toMatch(/DROP\s+TABLE/i);
    expect(mig195.joined).not.toMatch(/ALTER\s+TABLE/i);
    expect(mig195.joined).not.toContain(`t_${TABLE}`);
  });

  it("文本列显式 COLLATE utf8mb4_0900_ai_ci，且不得出现 utf8mb4_unicode_ci", () => {
    const create = mig195.migrated[0];
    const textColumns = create.match(/CHARACTER SET utf8mb4/g) ?? [];
    const explicitCollate = create.match(/CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci/g) ?? [];
    expect(textColumns.length).toBeGreaterThan(0);
    expect(explicitCollate.length).toBe(textColumns.length);
    expect(mig195.joined).not.toContain("utf8mb4_unicode_ci");
    expect(create).toContain("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");
  });

  it("注释块全部位于可执行语句之后，且注释文字内无 ASCII 分号（踩坑 [63]）", () => {
    const lines = mig195.raw.split("\n");
    const firstComment = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutable = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstComment).toBeGreaterThan(lastExecutable);
    expect(lines.filter((line) => line.trim().startsWith("--")).join("\n")).not.toContain(";");
  });
});

describe("C6-3-2b 台账表列/索引口径", () => {
  const create = () => mig195.migrated[0];

  it("主键 BIGINT UNSIGNED + 一被邀请租户一条 uk_invitee（卡 §三 硬约束）", () => {
    expect(create()).toContain("id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT");
    expect(create()).toContain("PRIMARY KEY (id)");
    expect(create()).toContain("UNIQUE KEY uk_invitee (invitee_tenant_id)");
  });

  it("逐列口径与卡 §三 一致（邀请人/被邀请人/编码/积分/基数口径/状态/发放时间/备注/时间列）", () => {
    const sql = create();
    expect(sql).toContain("inviter_tenant_id VARCHAR(36)");
    expect(sql).toContain("invitee_tenant_id VARCHAR(36)");
    expect(sql).toContain("invitee_tenant_code VARCHAR(64)");
    expect(sql).toContain("reward_points INT NOT NULL DEFAULT 0");
    expect(sql).toContain("reward_basis VARCHAR(32)");
    expect(sql).toContain("status VARCHAR(16)");
    expect(sql).toContain("DEFAULT 'PENDING'");
    expect(sql).toContain("granted_at DATETIME NULL");
    expect(sql).toContain("remark VARCHAR(255)");
    expect(sql).toContain("created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(sql).toContain("updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(sql).toContain("KEY idx_referral_inviter_created (inviter_tenant_id, created_at)");
    expect(sql).toContain("KEY idx_referral_status (status)");
  });

  it("零金额（红线①）：无任何金额/结算/提现/佣金类列（只看列名+类型，不看列注释里的口径名）", () => {
    const columnDefs = mig195.joined
      .split("\n")
      .filter((line) => /^\s*[A-Za-z_][\w]*\s+(BIGINT|INT|DECIMAL|VARCHAR|DATETIME)/i.test(line))
      // 列注释里会出现口径名（如 subscribe_amount），它描述的是"基数口径"，不是金额列本身
      .map((line) => line.split(/\bCOMMENT\b/i)[0]);
    const moneyColumns = columnDefs.filter((line) =>
      /(amount|money|settle|withdraw|balance|commission|profit)/i.test(line)
    );
    expect(moneyColumns).toEqual([]);
  });
});

describe("迁移编号不变量（195 唯一且 = 快照）", () => {
  it("195 只对应一个文件", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("195_"))).toEqual([FILE_195]);
  });
});
