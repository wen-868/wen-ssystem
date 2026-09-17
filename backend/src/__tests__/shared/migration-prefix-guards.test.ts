import { describe, it, expect, vi } from "vitest";

// 复用 migration-prefix.test.ts 的 mock，确保导入 migration.ts（顶层依赖 mysql/env/logger/seed-data）
// 时不触发真实数据库连接，只验证 addTablePrefix 的纯函数行为。
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

import { addTablePrefix, TABLE_NAME_PATTERNS, MISFIRE_GUARDS } from "../../shared/migration";

/**
 * S3-55B 反测/回归：覆盖清单（COVERAGE）每项一条 + 误伤清单（MISFIRE_GUARDS）每项一条。
 * 凌舟裁定：S3-52 是"漏模式"、S3-55B 是"过宽模式"——两个方向都要防住。
 */

describe("S3-55B 覆盖清单：收窄后的 INTO 仍覆盖真实表名", () => {
  it("INSERT_INTO: INSERT INTO tenant → t_tenant（收窄未误删真实表名）", () => {
    const out = addTablePrefix("INSERT INTO tenant (a) VALUES (1)");
    expect(out).toContain("INSERT INTO t_tenant");
  });

  it("INSERT_INTO: INSERT IGNORE INTO tenant → t_tenant", () => {
    const out = addTablePrefix("INSERT IGNORE INTO tenant (a) VALUES (1)");
    expect(out).toContain("INSERT IGNORE INTO t_tenant");
  });

  it("REPLACE_INTO: REPLACE INTO tenant → t_tenant（S3-55B 新增，补偿被删的通用 INTO）", () => {
    const out = addTablePrefix("REPLACE INTO tenant (id) VALUES (1)");
    expect(out).toContain("REPLACE INTO t_tenant");
  });

  it("结构：清单含 REPLACE_INTO、已无通用 INTO、共 12 个模式", () => {
    const names = TABLE_NAME_PATTERNS.map((p) => p.name);
    expect(names).toContain("REPLACE_INTO");
    expect(names).not.toContain("INTO"); // 过宽模式已删除
    expect(names).toHaveLength(12);
  });
});

describe("S3-55B 误伤清单 MISFIRE_GUARDS 应存在且含 5 项", () => {
  it("清单含 ALREADY_T_PREFIXED / SYSTEM_SCHEMA / SELECT_INTO_ASSIGNMENT / ON_UPDATE / ON_DUPLICATE_KEY_UPDATE", () => {
    const names = MISFIRE_GUARDS.map((g) => g.name);
    expect(names).toEqual([
      "ALREADY_T_PREFIXED",
      "SYSTEM_SCHEMA",
      "SELECT_INTO_ASSIGNMENT",
      "ON_UPDATE",
      "ON_DUPLICATE_KEY_UPDATE",
    ]);
  });
});

describe("S3-55B 误伤清单：SELECT ... INTO 赋值（092 实际案例）", () => {
  it("SELECT COUNT(*) INTO col_count 不被加前缀（092 第21行，原误伤为 t_col_count）", () => {
    const sql = "SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS WHERE TABLE_NAME = 'x'";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).toContain("INTO col_count");
    expect(out).not.toContain("t_col_count");
  });

  it("SELECT COUNT(*) INTO idx_count 不被加前缀（092 第47行，原误伤为 t_idx_count）", () => {
    const sql = "SELECT COUNT(*) INTO idx_count FROM information_schema.STATISTICS WHERE TABLE_NAME = 'x'";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).toContain("INTO idx_count");
    expect(out).not.toContain("t_idx_count");
  });
});

describe("S3-55B 误伤清单：ON UPDATE / ON DUPLICATE KEY UPDATE", () => {
  it("ON UPDATE CURRENT_TIMESTAMP 不误伤（UPDATE 不在语句开头）", () => {
    const sql = "CREATE TABLE t_x (id INT, upd DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).not.toContain("t_update");
  });

  it("ON DUPLICATE KEY UPDATE col 不误伤", () => {
    const sql = "INSERT INTO t_x (a) VALUES (1) ON DUPLICATE KEY UPDATE a = 1";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).not.toContain("t_a");
  });
});

describe("S3-55B 误伤清单：系统库 / 已前缀表名", () => {
  it("information_schema.x 不加前缀", () => {
    const sql = "SELECT * FROM information_schema.tables WHERE TABLE_SCHEMA='x'";
    const out = addTablePrefix(sql);
    expect(out).toContain("information_schema.tables");
    expect(out).not.toContain("t_information_schema");
  });

  it("mysql.x 不加前缀", () => {
    const sql = "SELECT * FROM mysql.user";
    const out = addTablePrefix(sql);
    expect(out).toContain("mysql.user");
    expect(out).not.toContain("t_mysql");
  });

  it("已带 t_ 的表名不重复加前缀（t_tenant 不会变 t_t_tenant）", () => {
    const sql = "ALTER TABLE t_tenant ADD COLUMN x INT";
    const out = addTablePrefix(sql);
    expect(out).toContain("t_tenant");
    expect(out).not.toContain("t_t_tenant");
  });
});
