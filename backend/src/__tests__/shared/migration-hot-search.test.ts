import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/155_hot_search.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("155_hot_search.sql", () => {
  it("创建 t_hot_search 表", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS t_hot_search");
    expect(sql).toContain("keyword VARCHAR(64)");
  });

  it("文件头必须以 SQL 语句开始", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });
});
