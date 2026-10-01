/**
 * S3-151 迁移 194 形状约束：条码唯一键由 (barcode) 全库唯一改为 (tenant_id, barcode) 租户内唯一
 *
 * 依据：docs/tasks/cards/R101-派单-20261002-S3-151.md 三、交付物①④ / 四、验收标准①②
 *   · 必须有：前置查重 SELECT + 幂等守卫（information_schema.STATISTICS）+ 一条 ALTER 完成 DROP 旧键/ADD 新键
 *   · 必须零 DML（MIG-4 写闸门默认 block 下整篇可执行），不得 DROP TABLE，不得回填数据
 *   · 必须带 回滚语句（注释里，含回滚前查重口径）
 *   · 注释文字内不得出现 ASCII 分号、可执行语句顶格写在注释块之前（规避踩坑日志 [63] 的丢块）
 * 切块与加前缀直接复用生产代码（splitSqlStatements / addTablePrefix），与运行时第 8 步同管线。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  addTablePrefix,
  isDataWriteStatement,
  isDropTableStatement,
  splitSqlStatements,
} from "../../shared/migration";

const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const MIG_194 = "194_条码唯一键改租户内唯一.sql";

const abs = resolve(MIGRATIONS_DIR, MIG_194);
expect(existsSync(abs), `缺少迁移文件 ${MIG_194}`).toBe(true);
const raw = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
const cleaned = raw
  .split("\n")
  .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
  .join("\n");
const statements = splitSqlStatements(cleaned);
const prefixed = statements.map((s) => addTablePrefix(s));
const joined = prefixed.join("\n");

describe("迁移 194 形状约束", () => {
  it("首条可执行语句是前置查重 SELECT（(tenant_id, barcode) 重数，期望 0 行）", () => {
    const firstExecutable = raw.split("\n").find((l) => l.trim().length > 0 && !l.trim().startsWith("--")) ?? "";
    expect(firstExecutable.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    const dupCheck = prefixed.find((s) => s.includes("HAVING COUNT(*) > 1"));
    expect(dupCheck).toBeTruthy();
    expect(dupCheck).toContain("FROM t_product_sku");
    expect(dupCheck).toContain("GROUP BY t.tenant_id, t.barcode");
    expect(dupCheck).toContain("barcode IS NOT NULL");
  });

  it("幂等守卫读 information_schema.STATISTICS 的 INDEX_NAME（新键/旧键各一）", () => {
    const guards = prefixed.filter((s) => s.includes("FROM information_schema.STATISTICS"));
    expect(guards.length).toBe(3); // 新键计数 + 旧键计数 + 跑后核对 SELECT
    expect(joined).toContain("INDEX_NAME = 'uk_product_sku_tenant_barcode'");
    expect(joined).toContain("INDEX_NAME = 'uk_product_sku_barcode'");
    expect(joined).toContain("TABLE_NAME = 't_product_sku'");
  });

  it("DDL：一条 ALTER 内 DROP 旧键 + ADD 复合新键，显式 ALGORITHM=INPLACE, LOCK=NONE", () => {
    expect(joined).toContain(
      "ALTER TABLE t_product_sku DROP INDEX uk_product_sku_barcode, ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE"
    );
    // 新库/灾备库（无旧键）分支：只 ADD，不 DROP
    expect(joined).toContain(
      "ALTER TABLE t_product_sku ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE"
    );
  });

  it("幂等：键已改时整句跳过（三分支 IF 的兜底分支输出跳过提示，不产生报错）", () => {
    const ddlVar = prefixed.find((s) => s.startsWith("SET @s3151_ddl"));
    expect(ddlVar).toBeTruthy();
    expect(ddlVar).toContain("IF(@s3151_new_key = 0 AND @s3151_old_key > 0");
    expect(ddlVar).toContain("IF(@s3151_new_key = 0");
    expect(ddlVar).toContain("S3-151 条码唯一键已是（tenant_id, barcode），整句跳过");
    expect(prefixed.filter((s) => /^PREPARE s3151_stmt FROM @s3151_ddl/.test(s))).toHaveLength(1);
    expect(prefixed.filter((s) => /^EXECUTE s3151_stmt/.test(s))).toHaveLength(1);
    expect(prefixed.filter((s) => /^DEALLOCATE PREPARE s3151_stmt/.test(s))).toHaveLength(1);
  });

  it("零 DML：无 INSERT / UPDATE / DELETE / REPLACE / CALL，写闸门 block 下整篇可执行", () => {
    for (const statement of statements) {
      expect(isDataWriteStatement(statement), `不该有数据写语句：${statement.slice(0, 60)}`).toBe(false);
    }
    expect(joined).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/im);
  });

  it("不 DROP TABLE、不建反引号标识符、不动 001 历史快照", () => {
    for (const statement of statements) {
      expect(isDropTableStatement(statement)).toBe(false);
    }
    expect(joined).not.toContain("`");
    expect(joined).not.toMatch(/DROP\s+TABLE/i);
    expect(joined).not.toContain("001_phase1_schema");
  });

  it("addTablePrefix 不误伤：information_schema 不被加前缀、t_product_sku 不被二次加前缀", () => {
    expect(joined).toContain("information_schema.STATISTICS");
    expect(joined).not.toContain("t_information_schema");
    expect(joined).not.toContain("t_t_product_sku");
  });

  it("回滚语句写进注释（含回滚前全库查重口径），且注释内无 ASCII 分号", () => {
    const comments = raw
      .split("\n")
      .filter((line) => line.trim().startsWith("--"))
      .join("\n");
    expect(comments).toContain("四、回滚语句");
    expect(comments).toContain("DROP INDEX uk_product_sku_tenant_barcode");
    expect(comments).toContain("ADD UNIQUE KEY uk_product_sku_barcode (barcode)");
    expect(comments).toContain("GROUP BY barcode HAVING COUNT(*) > 1");
    expect(comments).not.toContain(";");
  });

  it("可执行语句顶格写在注释块之前（踩坑 [63] 的丢块防线）", () => {
    const lines = raw.split("\n");
    const firstComment = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutable = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstComment).toBeGreaterThan(lastExecutable);
  });
});
