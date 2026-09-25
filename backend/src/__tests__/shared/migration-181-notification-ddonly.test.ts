/**
 * C6-2-T1 防回归：迁移 181（平台通知 + 已读两表）必须保持"纯 DDL + 口径逐字对齐"。
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md
 *   - 交付物①（两表逐列口径、引擎/collation、零预置数据、不建外键）；
 *   - 验收标准③（文本列 collation 全 utf8mb4_0900_ai_ci / 写语句 0 命中 / 全新空库两表建成）；
 *   - 验收标准⑤（零假数据：迁移不预置任何通知，空表恒空态）。
 *
 * 判定工具**与 runner 同源**（`splitSqlStatements` / `firstKeyword` / `isDataWriteStatement`），
 * 不自写正则复刻，否则断言与 runner 会各自漂移（假门禁）。
 * 反测：往 181 临时加回任意一条 INSERT ⇒ 本文件第一个用例必红；把 target_admin_id 改成 BIGINT ⇒
 * 类型用例必红。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  splitSqlStatements,
  firstKeyword,
  isDataWriteStatement,
} from "../../shared/migration";

/** 路径写法照 178 / 179 / 180 用例的既有惯例 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "181_平台通知.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");
const statements = splitSqlStatements(sql);
const keywords = statements.map((statement) => firstKeyword(statement));
const lines = sql.split(/\r?\n/);

/** 逐行取某列定义（用于口径逐字核对） */
function columnLine(columnName: string): string {
  return lines.find((line) => line.trim().startsWith(`${columnName} `)) ?? "";
}

describe("181_平台通知.sql 纯 DDL 约束（C6-2-T1）", () => {
  it("零数据写语句（反测：加回一条 INSERT ⇒ 本断言必红）", () => {
    const writes = statements.filter((statement) => isDataWriteStatement(statement));
    expect(writes).toEqual([]);
    expect(
      keywords.filter((k) => ["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"].includes(k))
    ).toEqual([]);
    // 全文直查（注释里也不得出现会被验收 rg 命中的"行首写语句关键字"）
    expect(lines.filter((line) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/.test(line))).toEqual([]);
  });

  it("两张表各由 1 条 CREATE TABLE IF NOT EXISTS 建成（表名 + 左括号精确匹配，避免前缀互相命中）", () => {
    const creates = statements.filter((statement) => firstKeyword(statement) === "CREATE");
    expect(creates).toHaveLength(2);
    for (const table of ["t_platform_notification", "t_platform_notification_read"]) {
      const pattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`);
      expect(creates.filter((statement) => pattern.test(statement))).toHaveLength(1);
    }
  });

  it("3 条跑后核对 SELECT 保留（表数 / 列 collation / 已读表零预置 旁证）", () => {
    const selects = statements.filter((statement) => firstKeyword(statement) === "SELECT");
    expect(selects).toHaveLength(3);
    expect(selects.filter((s) => s.includes("information_schema.TABLES"))).toHaveLength(1);
    expect(selects.filter((s) => s.includes("information_schema.COLUMNS"))).toHaveLength(1);
    expect(
      selects.filter((s) => s.includes("COUNT(*) AS c181_read_row_count FROM t_platform_notification_read"))
    ).toHaveLength(1);
  });

  it("注释块位于末条可执行语句之后，且注释文字内无 ASCII 分号（踩坑 [63]/MIG-1 伪语句风险）", () => {
    const firstCommentIndex = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutableIndex = lines.reduce(
      (last, line, index) =>
        line.trim().length > 0 && !line.trim().startsWith("--") ? index : last,
      0
    );
    expect(firstCommentIndex).toBeGreaterThan(lastExecutableIndex);
    expect(lines.filter((line) => line.trim().startsWith("--")).join("\n")).not.toContain(";");
  });
});

describe("181_平台通知.sql 口径逐字核对（C6-2-T1 交付物①）", () => {
  it("通知主表逐列口径（id/title/content/type/level/target_admin_id/link_url/created_at）", () => {
    expect(columnLine("id")).toContain("id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT");
    expect(columnLine("title")).toContain("title VARCHAR(255)");
    expect(columnLine("title")).toContain("NOT NULL");
    expect(columnLine("content")).toContain("content TEXT");
    expect(columnLine("content")).toContain("NULL");
    expect(columnLine("type")).toContain("type VARCHAR(32)");
    expect(columnLine("type")).toContain("NOT NULL");
    expect(columnLine("level")).toContain("level VARCHAR(16)");
    expect(columnLine("level")).toContain("DEFAULT 'INFO'");
    // 级别取值口径在注释里逐字登记（INFO/WARN/URGENT），避免与控制器/服务层三处漂移
    expect(columnLine("level")).toContain("INFO-提示/WARN-警告/URGENT-紧急");
    expect(columnLine("link_url")).toContain("link_url VARCHAR(512)");
    expect(columnLine("created_at")).toContain("created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  });

  it("target_admin_id 类型对齐 t_platform_admin.id = int，且可空（NULL = 全员通知）", () => {
    const line = columnLine("target_admin_id");
    expect(line).toContain("target_admin_id INT ");
    expect(line).not.toContain("BIGINT");
    expect(line).toContain("NULL");
    expect(line).toContain("NULL=全员通知");
  });

  it("已读表逐列口径（id/notification_id/admin_id/read_at）", () => {
    const readTable = statements.find((statement) => /CREATE TABLE IF NOT EXISTS t_platform_notification_read\s*\(/.test(statement)) ?? "";
    expect(readTable).toContain("notification_id BIGINT UNSIGNED NOT NULL");
    expect(readTable).toContain("admin_id INT NOT NULL");
    expect(readTable).toContain("read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    // 已读表不得带 tenant_id（平台级语义）
    expect(readTable).not.toMatch(/^\s*tenant_id\s/im);
  });

  it("索引口径：主键 + (target_admin_id, created_at) + created_at + 已读唯一键 + admin_id", () => {
    expect(sql).toContain("PRIMARY KEY (id)");
    expect(sql).toContain("KEY idx_target_created (target_admin_id, created_at)");
    expect(sql).toContain("KEY idx_created (created_at)");
    expect(sql).toContain("UNIQUE KEY uk_notif_admin (notification_id, admin_id)");
    expect(sql).toContain("KEY idx_admin (admin_id)");
  });

  it("平台级语义：两表均不定义 tenant_id 列；也不建物理外键（卡内裁定）", () => {
    expect(lines.filter((line) => /^\s*tenant_id\s/.test(line))).toEqual([]);
    expect(sql).not.toContain("REFERENCES");
    expect(sql.toUpperCase()).not.toContain("FOREIGN KEY");
  });

  it("不 ALTER / 不 DROP 既有表（红线①②）", () => {
    expect(keywords.filter((k) => k === "ALTER" || k === "DROP")).toEqual([]);
    expect(sql).not.toMatch(/^\s*(ALTER|DROP)\s/im);
  });

  it("全部文本列显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（不默认继承库 collation）", () => {
    const textColumns = lines.filter((line) => /\b(VARCHAR|TEXT)\b/.test(line) && !line.trim().startsWith("--"));
    expect(textColumns.length).toBeGreaterThanOrEqual(5);
    for (const line of textColumns) {
      expect(line).toContain("CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
    }
    // 旧口径必须零命中（立项卡 §二：不继承库级排序规则）
    expect(sql).not.toContain("utf8mb4_unicode_ci");
    // 表级 ENGINE/CHARSET/COLLATE 口径（2 张表各一次）
    expect(
      lines.filter((line) => line.includes("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"))
    ).toHaveLength(2);
  });
});
