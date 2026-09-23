/**
 * MIG-5：addTablePrefix 同族收口守门单测（REFERENCES / INTO）
 *
 * 背景（本单派工卡交付物 2）：`addTablePrefix` 的同族旧补丁一直未合入 main ——
 *   · #14：漏 `REFERENCES` ⇒ `FOREIGN KEY (x) REFERENCES tenant(id)` 里的 tenant 未加前缀；
 *   · #17：通用 `INTO` 模式过宽 ⇒ `SELECT COUNT(*) INTO col_count`（092 存储过程变量）被误改成 t_col_count。
 * 本文件把这两点按**已在 main 的反引号形态**（MIG-2）钉死：全套模式统一支持反引号与裸名。
 *
 * 反引号（MIG-2）的存留断言在 `migration.test.ts` 的 `MIG-2:` 段（未改动，覆盖不得减少），
 * 本文件只补 REFERENCES / INTO 两类，并在 docs/evidence/MIG-5/tools/mig5-verify.mjs 里以同源断言复跑
 * （含"把同族收口回退 ⇒ 本文件反测位变红"）。
 */
import { describe, it, expect, vi } from "vitest";

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

import { addTablePrefix } from "../../shared/migration";

describe("MIG-5 REFERENCES 模式（原 #14/S3-52 漏模式）", () => {
  it("裸名：FOREIGN KEY (tenant_id) REFERENCES tenant(id) → REFERENCES t_tenant(", () => {
    const out = addTablePrefix("FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE");
    expect(out).toContain("REFERENCES t_tenant(");
  });

  it("反引号：REFERENCES `retail_order` (`id`) → REFERENCES `t_retail_order`（074 风格）", () => {
    const out = addTablePrefix("FOREIGN KEY (order_id) REFERENCES `retail_order` (`id`) ON DELETE CASCADE");
    expect(out).toContain("REFERENCES `t_retail_order`");
    expect(out).not.toContain("t_t_retail_order");
  });

  it("已带 t_ 前缀不重复加：REFERENCES t_tenant(id) 原样返回", () => {
    const sql = "FOREIGN KEY (a) REFERENCES t_tenant(id)";
    expect(addTablePrefix(sql)).toBe(sql);
  });

  it("CREATE TABLE 内含外键时，表名与引用表名都被加前缀", () => {
    const out = addTablePrefix(
      "CREATE TABLE IF NOT EXISTS subscription (id INT, tenant_id INT, FOREIGN KEY (tenant_id) REFERENCES tenant(id))"
    );
    expect(out).toContain("CREATE TABLE IF NOT EXISTS t_subscription");
    expect(out).toContain("REFERENCES t_tenant(");
  });
});

describe("MIG-5 INTO 模式收窄（原 #17/S3-55B 过宽）", () => {
  it("SELECT ... INTO 过程变量不得被加前缀（092 实际案例 col_count）", () => {
    const sql = "SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS WHERE TABLE_NAME = 'x'";
    expect(addTablePrefix(sql)).toBe(sql);
    expect(addTablePrefix(sql)).not.toContain("t_col_count");
  });

  it("SELECT ... INTO 过程变量不得被加前缀（092 实际案例 idx_count）", () => {
    const sql = "SELECT COUNT(*) INTO idx_count FROM information_schema.STATISTICS WHERE TABLE_NAME = 'x'";
    expect(addTablePrefix(sql)).toBe(sql);
    expect(addTablePrefix(sql)).not.toContain("t_idx_count");
  });

  it("收窄后仍覆盖真实表名：INSERT INTO / INSERT IGNORE INTO / REPLACE INTO 都加前缀", () => {
    expect(addTablePrefix("INSERT INTO price_level (a) VALUES (1)")).toContain("INSERT INTO t_price_level");
    expect(addTablePrefix("INSERT IGNORE INTO price_level (a) VALUES (1)")).toContain(
      "INSERT IGNORE INTO t_price_level"
    );
    expect(addTablePrefix("REPLACE INTO price_level (a) VALUES (1)")).toContain("REPLACE INTO t_price_level");
  });

  it("反引号形态同样覆盖：INSERT IGNORE INTO `price_level` → `t_price_level`", () => {
    const out = addTablePrefix("INSERT IGNORE INTO `price_level` (`a`) VALUES (1)");
    expect(out).toContain("INSERT IGNORE INTO `t_price_level`");
    expect(out).not.toContain("t_t_price_level");
  });

  it("回归：ON UPDATE CURRENT_TIMESTAMP / ON DUPLICATE KEY UPDATE col 不被误伤", () => {
    const ddl = "CREATE TABLE t_x (id INT, upd DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)";
    expect(addTablePrefix(ddl)).toBe(ddl);
    const dml = "INSERT INTO t_x (a) VALUES (1) ON DUPLICATE KEY UPDATE a = 1";
    expect(addTablePrefix(dml)).toBe(dml);
  });
});
