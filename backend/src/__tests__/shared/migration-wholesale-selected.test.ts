import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/154_wholesale_cart_selected.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("154_wholesale_cart_selected.sql", () => {
  it("文件头必须以 SQL 语句开始", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });

  it("t_wholesale_cart 增加 selected 列", () => {
    expect(sql).toContain("ADD COLUMN selected TINYINT");
  });
});
