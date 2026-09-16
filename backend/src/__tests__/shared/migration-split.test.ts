import { describe, it, expect, vi } from "vitest";

// 复用 migration.test.ts 的 mock，确保导入 migration.ts（其顶层依赖 mysql/env/logger）
// 时不触发真实数据库连接。仅验证 splitSqlStatements 的纯函数行为。
vi.mock("mysql2/promise", () => ({
  default: { createConnection: vi.fn() },
}));
vi.mock("../../shared/env", () => ({
  env: {
    USE_MOCK_DB: false,
    DB_HOST: "localhost",
    DB_PORT: 3306,
    DB_USER: "root",
    DB_PASSWORD: "test",
    DB_NAME: "test_db",
  },
}));
vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { splitSqlStatements } from "../../shared/migration";

// 复刻 migration.ts 第8步 / 5.5.8 步的预处理：先移除 USE / DELIMITER 行，再拆分。
// 仅用于回归测试，需与源码保持一致（USE/DELIMITER 在本步被剔除，不属于 splitSqlStatements 职责）。
function cleanAndSplit(sql: string): string[] {
  const cleaned = sql
    .split("\n")
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
    })
    .join("\n");
  return splitSqlStatements(cleaned);
}

describe("splitSqlStatements (S3-51 修复守门)", () => {
  it("前导注释 + CREATE TABLE 应保留建表语句（修复前会丢失首条建表）", () => {
    const sql = `-- 编号: 031 订阅表\nCREATE TABLE IF NOT EXISTS t_subscription (\n  id INT PRIMARY KEY\n);`;
    const result = splitSqlStatements(sql);
    expect(result.some((s) => s.includes("CREATE TABLE") && s.includes("t_subscription"))).toBe(true);
  });

  it("纯注释块应返回空数组", () => {
    const sql = `-- 仅注释\n-- 第二行注释`;
    expect(splitSqlStatements(sql)).toEqual([]);
  });

  it("语句中间的 -- 不应被截断（COMMENT 'a--b' 原样保留）", () => {
    const sql = `CREATE TABLE t_y (id INT COMMENT 'a--b');`;
    const result = splitSqlStatements(sql);
    expect(result.some((s) => s.includes("COMMENT 'a--b'"))).toBe(true);
  });

  it("行内注释（语句末尾 --）应原样保留，不被当块丢弃", () => {
    const sql = `-- 说明\nCREATE TABLE t_x (id INT);\nSELECT 1 -- 行内注释`;
    const result = splitSqlStatements(sql);
    expect(result.some((s) => s.includes("CREATE TABLE t_x"))).toBe(true);
    expect(result.some((s) => s.includes("SELECT 1") && s.includes("-- 行内注释"))).toBe(true);
  });

  it("回归：USE / DELIMITER 行仍被剔除", () => {
    const sql = `USE liquor_inventory;\nDELIMITER $$\nCREATE TABLE t_z (id INT);\nDELIMITER ;`;
    const result = cleanAndSplit(sql);
    expect(result.some((s) => s.toUpperCase().startsWith("USE "))).toBe(false);
    expect(result.some((s) => s.toUpperCase().startsWith("DELIMITER "))).toBe(false);
    expect(result.some((s) => s.includes("CREATE TABLE t_z"))).toBe(true);
  });

  it("回归：CREATE PROCEDURE / DROP TABLE 语句仍进入拆分结果（循环内再跳过，此处只验证拆分）", () => {
    const sql = `CREATE TABLE t_a (id INT);\nCREATE PROCEDURE p_x() BEGIN END;\nDROP TABLE IF EXISTS t_b;`;
    const result = splitSqlStatements(sql);
    expect(result.some((s) => s.includes("CREATE PROCEDURE"))).toBe(true);
    expect(result.some((s) => s.includes("DROP TABLE"))).toBe(true);
  });
});
