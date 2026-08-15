import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 回归保护：151 迁移补齐 t_points_record / t_points_rule 缺失列。
 *
 * 背景（验收缺陷）：服务端存在三套 t_points_record 列引用——
 *  071 客户积分 customer_id/points/balance_after/source_no；
 *  108 小程序会员积分 member_id/change_points/balance_points/source_id；
 *  旧营销积分 user_id/amount/balance/source_id（admin-marketing-points 路由，app-mobile 调用）。
 * 迁移 CREATE IF NOT EXISTS 只按首次定义建表，其余服务 SQL 在真实库报未知列 500。
 * 本迁移幂等补齐缺失列与索引，三套引用全部可用。
 */
const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/151_points_columns_fill.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("151_points_columns_fill.sql", () => {
  it("文件头必须以 SQL 语句开始（自动迁移按分号拆分，注释污染首条语句会被丢弃）", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });

  it("t_points_record 补齐小程序会员积分列（108 设计）", () => {
    expect(sql).toContain("ADD COLUMN member_id BIGINT UNSIGNED");
    expect(sql).toContain("ADD COLUMN change_points INT");
    expect(sql).toContain("ADD COLUMN balance_points INT");
  });

  it("t_points_record 补齐旧营销积分列（admin-marketing-points / app-mobile 依赖）", () => {
    expect(sql).toContain("ADD COLUMN user_id BIGINT UNSIGNED");
    expect(sql).toContain("ADD COLUMN amount INT");
    expect(sql).toContain("ADD COLUMN balance INT");
    expect(sql).toContain("ADD COLUMN source_id VARCHAR(64)");
  });

  it("t_points_record 补齐 user/member 索引", () => {
    expect(sql).toContain("ADD INDEX idx_points_record_user");
    expect(sql).toContain("ADD INDEX idx_points_record_member");
  });

  it("t_points_rule 补齐营销积分规则列", () => {
    expect(sql).toContain("ADD COLUMN earn_ratio DECIMAL(6,4)");
    expect(sql).toContain("ADD COLUMN redeem_ratio DECIMAL(6,4)");
    expect(sql).toContain("ADD COLUMN min_redeem_amount DECIMAL(10,2)");
    expect(sql).toContain("ADD COLUMN max_redeem_ratio DECIMAL(6,4)");
    expect(sql).toContain("ADD COLUMN expire_days INT");
  });

  it("每条 SQL 语句以分号结尾（迁移按分号拆分执行）", () => {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    expect(statements.length).toBeGreaterThanOrEqual(12);
  });
});
