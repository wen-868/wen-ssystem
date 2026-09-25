/**
 * C6-2-T7 防回归：迁移 180（平台工单系统四表）必须保持"纯 DDL + 口径逐字对齐"。
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md
 *   - 交付物①（四表逐列口径、引擎/collation、零预置数据、不建外键）；
 *   - 验收标准④（utf8mb4_0900_ai_ci 逐条命中 / utf8mb4_unicode_ci 与 tenant_id VARCHAR(32) 零命中 /
 *     tenant_id VARCHAR(36) 命中）；
 *   - 验收标准⑧（迁移纯 DDL：零 INSERT/UPDATE/DELETE/REPLACE）。
 *
 * 判定工具**与 runner 同源**（`splitSqlStatements` / `firstKeyword` / `isDataWriteStatement`），
 * 不自写正则复刻，否则断言与 runner 会各自漂移（假门禁）。
 * 反测：往 180 临时加回任意一条 INSERT ⇒ 本文件第一个用例必红；把 tenant_id 改回 VARCHAR(32) ⇒
 * collation/类型用例必红。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  splitSqlStatements,
  firstKeyword,
  isDataWriteStatement,
} from "../../shared/migration";

/** 路径写法照 178 / 179 用例的既有惯例 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, "180_平台工单系统.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");
const statements = splitSqlStatements(sql);
const keywords = statements.map((statement) => firstKeyword(statement));
const lines = sql.split(/\r?\n/);

/** 逐行取某列定义（用于口径逐字核对） */
function columnLine(columnName: string): string {
  return lines.find((line) => line.trim().startsWith(`${columnName} `)) ?? "";
}

describe("180_平台工单系统.sql 纯 DDL 约束（C6-2-T7）", () => {
  it("零数据写语句（反测：加回一条 INSERT ⇒ 本断言必红）", () => {
    const writes = statements.filter((statement) => isDataWriteStatement(statement));
    expect(writes).toEqual([]);
    expect(
      keywords.filter((k) => ["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"].includes(k))
    ).toEqual([]);
    // 全文直查（注释里也不得出现会被验收 rg 命中的"行首写语句关键字"）
    expect(lines.filter((line) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/.test(line))).toEqual([]);
  });

  it("四张表各由 1 条 CREATE TABLE IF NOT EXISTS 建成（表名 + 左括号精确匹配，避免前缀互相命中）", () => {
    const creates = statements.filter((statement) => firstKeyword(statement) === "CREATE");
    expect(creates).toHaveLength(4);
    for (const table of [
      "t_support_ticket",
      "t_support_ticket_message",
      "t_support_ticket_attachment",
      "t_support_ticket_category",
    ]) {
      const pattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`);
      expect(creates.filter((statement) => pattern.test(statement))).toHaveLength(1);
    }
  });

  it("3 条跑后核对 SELECT 保留（表数 / 列 collation / 类型表零预置 旁证）", () => {
    const selects = statements.filter((statement) => firstKeyword(statement) === "SELECT");
    expect(selects).toHaveLength(3);
    expect(selects.filter((s) => s.includes("information_schema.TABLES"))).toHaveLength(1);
    expect(selects.filter((s) => s.includes("information_schema.COLUMNS"))).toHaveLength(1);
    expect(
      selects.filter((s) => s.includes("COUNT(*) AS c180_category_row_count FROM t_support_ticket_category"))
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

describe("180_平台工单系统.sql 口径逐字核对（C6-2-T7 验收标准④）", () => {
  it("tenant_id 逐字对齐 t_tenant.id：VARCHAR(36) + utf8mb4_0900_ai_ci（反测：改回 32/unicode_ci 即变红）", () => {
    const tenantLine = columnLine("tenant_id");
    expect(tenantLine).toContain("tenant_id VARCHAR(36)");
    expect(tenantLine).toContain("CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
    expect(tenantLine).toContain("NOT NULL");
    // 旧草案口径必须零命中
    expect(sql).not.toContain("utf8mb4_unicode_ci");
    expect(lines.filter((line) => /VARCHAR\(32\).*tenant_id/.test(line))).toEqual([]);
  });

  it("assignee_id 类型对齐 t_platform_admin.id = int（不是 BIGINT）", () => {
    const assigneeLine = columnLine("assignee_id");
    expect(assigneeLine).toContain("assignee_id INT ");
    expect(assigneeLine).not.toContain("BIGINT");
    expect(assigneeLine).toContain("NULL");
  });

  it("不建外键：全文无 REFERENCES / FOREIGN KEY（卡内裁定；但类型逐字对齐）", () => {
    expect(sql).not.toContain("REFERENCES");
    expect(sql.toUpperCase()).not.toContain("FOREIGN KEY");
  });

  it("不 ALTER / 不 DROP 既有表（红线①②）", () => {
    expect(keywords.filter((k) => k === "ALTER" || k === "DROP")).toEqual([]);
    expect(sql).not.toMatch(/^\s*(ALTER|DROP)\s/im);
  });

  it("全部文本列显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（不默认继承库 collation）", () => {
    // 四表 CREATE 内每个 VARCHAR/TEXT 列都必须带显式 collation
    const textColumns = lines.filter((line) => /\b(VARCHAR|TEXT)\b/.test(line) && !line.trim().startsWith("--"));
    expect(textColumns.length).toBeGreaterThanOrEqual(15);
    for (const line of textColumns) {
      expect(line).toContain("CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
    }
    // 表级 ENGINE/CHARSET/COLLATE 口径（4 张表各一次）
    expect(lines.filter((line) => line.includes("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"))).toHaveLength(4);
  });

  it("索引口径：ticket_no 唯一 + 三条辅助索引 + 消息/附件/类型表索引与唯一键", () => {
    expect(sql).toContain("UNIQUE KEY uk_ticket_no (ticket_no)");
    expect(sql).toContain("KEY idx_tenant_status (tenant_id, status)");
    expect(sql).toContain("KEY idx_assignee_status (assignee_id, status)");
    expect(sql).toContain("KEY idx_created_at (created_at)");
    expect(sql).toContain("KEY idx_ticket_created (ticket_id, created_at)");
    expect(sql).toContain("KEY idx_bubble_type (bubble_type)");
    expect(sql).toContain("KEY idx_ticket_id (ticket_id)");
    expect(sql).toContain("UNIQUE KEY uk_slug (slug)");
  });

  it("SLA 不计算：sla_deadline 可空 + sla_hours 仅作配置字段（注释写明口径未定）", () => {
    const slaDeadlineLine = columnLine("sla_deadline");
    expect(slaDeadlineLine).toContain("sla_deadline DATETIME NULL");
    expect(slaDeadlineLine).toContain("口径未定");
    const slaHoursLine = columnLine("sla_hours");
    expect(slaHoursLine).toContain("INT NOT NULL DEFAULT 24");
    expect(slaHoursLine).toContain("不参与任何计算");
  });
});
