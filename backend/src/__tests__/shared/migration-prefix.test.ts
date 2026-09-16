import { describe, it, expect, vi } from "vitest";

// 复用 migration-split.test.ts 的 mock，确保导入 migration.ts（顶层依赖 mysql/env/logger/seed-data）
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

import { addTablePrefix, TABLE_NAME_PATTERNS } from "../../shared/migration";

describe("addTablePrefix 具名清单结构 (S3-52)", () => {
  it("清单应包含 S3-52 修复新增的 REFERENCES 与 CREATE_INDEX_ON，共 12 个模式", () => {
    const names = TABLE_NAME_PATTERNS.map((p) => p.name);
    expect(names).toContain("REFERENCES");
    expect(names).toContain("CREATE_INDEX_ON");
    // 原 10 个 + 新增 2 个 = 12
    expect(names).toHaveLength(12);
  });
});

describe("addTablePrefix 逐模式：表名被加 t_ 前缀", () => {
  it("CREATE_TABLE: CREATE TABLE tenant → t_tenant", () => {
    const out = addTablePrefix("CREATE TABLE tenant (id INT)");
    expect(out).toContain("CREATE TABLE t_tenant");
  });

  it("ALTER_TABLE: ALTER TABLE tenant → t_tenant", () => {
    const out = addTablePrefix("ALTER TABLE tenant ADD COLUMN x INT");
    expect(out).toContain("ALTER TABLE t_tenant");
  });

  it("INSERT_INTO: INSERT INTO tenant → t_tenant", () => {
    const out = addTablePrefix("INSERT INTO tenant (a) VALUES (1)");
    expect(out).toContain("INSERT INTO t_tenant");
  });

  it("UPDATE(语句开头): UPDATE tenant SET x=1 → t_tenant", () => {
    const out = addTablePrefix("UPDATE tenant SET x=1");
    expect(out).toContain("UPDATE t_tenant");
  });

  it("DELETE_FROM: DELETE FROM tenant WHERE 1 → t_tenant", () => {
    const out = addTablePrefix("DELETE FROM tenant WHERE 1=1");
    expect(out).toContain("DELETE FROM t_tenant");
  });

  it("FROM: SELECT * FROM tenant → t_tenant", () => {
    const out = addTablePrefix("SELECT * FROM tenant");
    expect(out).toContain("FROM t_tenant");
  });

  it("JOIN: FROM t_a JOIN tenant → JOIN t_tenant", () => {
    const out = addTablePrefix("SELECT * FROM t_a JOIN tenant ON t_a.id = tenant.id");
    expect(out).toContain("JOIN t_tenant");
  });

  it("INTO: REPLACE INTO tenant → t_tenant（INTO 模式顺带覆盖 REPLACE INTO，扫描 0 次但安全）", () => {
    const out = addTablePrefix("REPLACE INTO tenant (id) VALUES (1)");
    expect(out).toContain("INTO t_tenant");
  });

  it("REFERENCES: REFERENCES tenant(id) → REFERENCES t_tenant(（S3-52 主修复点）", () => {
    const out = addTablePrefix("FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE");
    expect(out).toContain("REFERENCES t_tenant(");
  });

  it("REFERENCES 反引号: REFERENCES `tenant`(id) → REFERENCES `t_tenant`(（074 风格）", () => {
    const out = addTablePrefix("FOREIGN KEY (order_id) REFERENCES `retail_order` (`id`) ON DELETE CASCADE");
    expect(out).toContain("REFERENCES `t_retail_order`");
    expect(out).not.toContain("t_t_retail_order"); // 不重复加前缀
  });

  it("CREATE_INDEX_ON: CREATE INDEX idx ON inventory_balance → ON t_inventory_balance（索引名不被当表名）", () => {
    const out = addTablePrefix("CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id)");
    expect(out).toContain("ON t_inventory_balance(");
    // 索引名 idx_tenant_ib 不应被加前缀
    expect(out).toContain("idx_tenant_ib");
    expect(out).not.toContain("t_idx_tenant_ib");
  });

  it("RENAME_TABLE: RENAME TABLE tenant → t_tenant", () => {
    const out = addTablePrefix("RENAME TABLE tenant TO tenant_bak");
    expect(out).toContain("RENAME TABLE t_tenant");
  });

  it("DROP_TABLE: DROP TABLE IF EXISTS tenant → t_tenant", () => {
    const out = addTablePrefix("DROP TABLE IF EXISTS tenant");
    expect(out).toContain("DROP TABLE IF EXISTS t_tenant");
  });
});

describe("addTablePrefix 回归：已前缀/系统库/高危误伤", () => {
  it("已带 t_ 的表名不重复加前缀（t_tenant 不会变 t_t_tenant）", () => {
    const out = addTablePrefix("ALTER TABLE t_tenant ADD COLUMN x INT");
    expect(out).toContain("t_tenant");
    expect(out).not.toContain("t_t_tenant");
  });

  it("REFERENCES 已带 t_ 的反引号名不重复加前缀", () => {
    const out = addTablePrefix("FOREIGN KEY (order_id) REFERENCES `t_retail_order` (`id`)");
    expect(out).toContain("`t_retail_order`");
    expect(out).not.toContain("t_t_retail_order");
  });

  it("ON UPDATE CURRENT_TIMESTAMP 不被误伤（UPDATE 不在语句开头）", () => {
    const sql = "CREATE TABLE t_x (id INT, upd DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).not.toContain("t_update");
  });

  it("ON DUPLICATE KEY UPDATE col 不被误伤（UPDATE 不在语句开头）", () => {
    const sql = "INSERT INTO t_x (a) VALUES (1) ON DUPLICATE KEY UPDATE a = 1";
    const out = addTablePrefix(sql);
    expect(out).toBe(sql);
    expect(out).not.toContain("t_a");
  });

  it("information_schema 前缀名不加前缀", () => {
    const out = addTablePrefix("SELECT * FROM information_schema.tables WHERE TABLE_SCHEMA='x'");
    expect(out).toContain("information_schema.tables");
    expect(out).not.toContain("t_information_schema");
  });

  it("mysql 系统库前缀名不加前缀", () => {
    const out = addTablePrefix("SELECT * FROM mysql.user");
    expect(out).toContain("mysql.user");
    expect(out).not.toContain("t_mysql");
  });

  it("CREATE INDEX 已带 t_ 的表名不重复加前缀（163_ 场景）", () => {
    const sql = "CREATE INDEX idx_tto_status ON t_transfer_order (status)";
    const out = addTablePrefix(sql);
    expect(out).toContain("ON t_transfer_order");
    expect(out).not.toContain("t_t_transfer_order");
  });
});
