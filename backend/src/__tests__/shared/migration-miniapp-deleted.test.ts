import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/156_miniapp_order_deleted.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("156_miniapp_order_deleted.sql", () => {
  it("t_miniapp_order 增加 deleted_at 软删列", () => {
    expect(sql).toContain("ADD COLUMN deleted_at DATETIME");
  });

  it("文件头必须以 SQL 语句开始", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });
});
