/**
 * C6-2-T5 防回归：迁移 183（商品库 SPU 审核流水单表）必须保持"纯 DDL + 口径逐字对齐"。
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T5.md
 *   - 交付物①（逐列口径、engine/collation、零预置数据、不建外键）；
 *   - 验收标准③（全新空库跑 183 能建成；文本列 collation 全 utf8mb4_0900_ai_ci；
 *     行首 INSERT/UPDATE/DELETE/REPLACE 零命中）；
 *   - 验收标准⑤（零假数据：迁移只做结构，不预置任何流水行）。
 *
 * 判定工具**与 runner 同源**（`splitSqlStatements` / `firstKeyword` / `isDataWriteStatement`），
 * 不自写正则复刻，否则断言与 runner 会各自漂移（假门禁）。
 * 反测：往 183 临时加回任意一条 INSERT ⇒ 本文件第一个用例必红；把 action 列宽/reason 列宽改掉 ⇒
 * 逐列口径用例必红。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  splitSqlStatements,
  firstKeyword,
  isDataWriteStatement,
} from "../../shared/migration";

/** 路径写法照 178 / 179 / 180 用例的既有惯例 */
const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIGRATION_FILE_NAME = "183_商品库审核流水.sql";
const MIGRATION_FILE = resolve(MIGRATIONS_DIR, MIGRATION_FILE_NAME);
const sql = readFileSync(MIGRATION_FILE, "utf-8");
const statements = splitSqlStatements(sql);
const keywords = statements.map((statement) => firstKeyword(statement));
const lines = sql.split(/\r?\n/);

/** 逐行取某列定义（用于口径逐字核对） */
function columnLine(columnName: string): string {
  return lines.find((line) => line.trim().startsWith(`${columnName} `)) ?? "";
}

describe("183_商品库审核流水.sql 纯 DDL 约束（C6-2-T5）", () => {
  it("零数据写语句（反测：加回一条 INSERT ⇒ 本断言必红）", () => {
    const writes = statements.filter((statement) => isDataWriteStatement(statement));
    expect(writes).toEqual([]);
    expect(
      keywords.filter((k) => ["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"].includes(k))
    ).toEqual([]);
    // 全文直查（注释里也不得出现会被验收 rg 命中的"行首写语句关键字"）
    expect(lines.filter((line) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/.test(line))).toEqual([]);
  });

  it("唯一一张表由 1 条 CREATE TABLE IF NOT EXISTS 建成（零 ALTER / 零 DROP / 零第二张表）", () => {
    const creates = statements.filter((statement) => firstKeyword(statement) === "CREATE");
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatch(/CREATE TABLE IF NOT EXISTS t_library_spu_review_log\s*\(/);
    expect(keywords.filter((k) => k === "ALTER" || k === "DROP")).toEqual([]);
    expect(sql).not.toMatch(/^\s*(ALTER|DROP)\s/im);
  });

  it("3 条跑后核对 SELECT 保留（表数 / 列 collation / 零预置行数旁证）", () => {
    const selects = statements.filter((statement) => firstKeyword(statement) === "SELECT");
    expect(selects).toHaveLength(3);
    expect(selects.filter((s) => s.includes("information_schema.TABLES"))).toHaveLength(1);
    expect(selects.filter((s) => s.includes("information_schema.COLUMNS"))).toHaveLength(1);
    expect(
      selects.filter((s) => s.includes("COUNT(*) AS c183_row_count FROM t_library_spu_review_log"))
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

describe("183_商品库审核流水.sql 逐列口径（C6-2-T5 交付物①）", () => {
  it("spu_id 为 BIGINT UNSIGNED NOT NULL（逻辑引用 t_library_spu.id，不建外键）", () => {
    const line = columnLine("spu_id");
    expect(line).toContain("spu_id BIGINT UNSIGNED NOT NULL");
    expect(line).toContain("t_library_spu.id");
  });

  it("action 为 VARCHAR(16) NOT NULL，四值口径写在 COMMENT 里（SUBMIT/APPROVE/REJECT/OFFLINE）", () => {
    const line = columnLine("action");
    expect(line).toContain("action VARCHAR(16)");
    expect(line).toContain("CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
    expect(line).toContain("NOT NULL");
    for (const value of ["SUBMIT", "APPROVE", "REJECT", "OFFLINE"]) {
      expect(line).toContain(value);
    }
  });

  it("from_status 可空 / to_status 必填（真实前后值成对记录）", () => {
    const fromLine = columnLine("from_status");
    expect(fromLine).toContain("from_status VARCHAR(16)");
    expect(fromLine).toContain("NULL");
    expect(fromLine).not.toContain("NOT NULL");
    const toLine = columnLine("to_status");
    expect(toLine).toContain("to_status VARCHAR(16)");
    expect(toLine).toContain("NOT NULL");
  });

  it("operator_id 类型对齐 t_platform_admin.id = int（不是 BIGINT）且可空", () => {
    const line = columnLine("operator_id");
    expect(line).toContain("operator_id INT NULL");
    expect(line).not.toContain("BIGINT");
  });

  it("operator_name VARCHAR(64) / reason VARCHAR(255) 均可空（NULL=未记录/未填写）", () => {
    const nameLine = columnLine("operator_name");
    expect(nameLine).toContain("operator_name VARCHAR(64)");
    expect(nameLine).toContain("NULL");
    const reasonLine = columnLine("reason");
    expect(reasonLine).toContain("reason VARCHAR(255)");
    expect(reasonLine).toContain("NULL");
  });

  it("created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", () => {
    const line = columnLine("created_at");
    expect(line).toContain("created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  });

  it("主键与索引口径：PRIMARY KEY (id) + KEY idx_spu_created (spu_id, created_at)", () => {
    expect(sql).toContain("PRIMARY KEY (id)");
    expect(sql).toContain("KEY idx_spu_created (spu_id, created_at)");
  });

  it("不建外键：全文无 REFERENCES / FOREIGN KEY（卡内裁定；列类型已逐字对齐）", () => {
    expect(sql).not.toContain("REFERENCES");
    expect(sql.toUpperCase()).not.toContain("FOREIGN KEY");
  });

  it("全部文本列显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（不默认继承库 collation）", () => {
    const textColumns = lines.filter(
      (line) => /\b(VARCHAR|TEXT)\b/.test(line) && !line.trim().startsWith("--")
    );
    expect(textColumns.length).toBeGreaterThanOrEqual(4);
    for (const line of textColumns) {
      expect(line).toContain("CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
    }
    // 表级 ENGINE/CHARSET/COLLATE 口径（单表 ⇒ 恰好 1 次）
    expect(
      lines.filter((line) =>
        line.includes("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci")
      )
    ).toHaveLength(1);
    // 旧口径不得出现
    expect(sql).not.toContain("utf8mb4_unicode_ci");
  });

  it("MIG-2 反测：不使用反引号包表名，addTablePrefix 不产生 t_t_ 前缀污染", () => {
    expect(sql).not.toContain("`");
    expect(sql).not.toContain("t_t_library_spu_review_log");
  });

  it("迁移编号唯一：docs/migrations 下 183 只对应本文件", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("183_"))).toEqual([MIGRATION_FILE_NAME]);
  });
});
