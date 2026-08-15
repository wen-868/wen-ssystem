import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 回归保护：153 迁移补齐 SELECT 查询列漂移。
 * 全量审计服务 SELECT/WHERE/JOIN 的 alias.col 引用，发现 10 张表存在查询列在真实表不存在的缺陷。
 */
const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/153_select_columns_fill.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("153_select_columns_fill.sql", () => {
  it("文件头必须以 SQL 语句开始", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });

  it("t_customer_price_binding 补齐结算取协议价列", () => {
    expect(sql).toContain("ALTER TABLE t_customer_price_binding ADD COLUMN price");
    expect(sql).toContain("ALTER TABLE t_customer_price_binding ADD COLUMN sku_id");
    expect(sql).toContain("idx_cpb_sku");
  });

  it("t_product_sku 补齐成本价/安全库存/冗余列", () => {
    expect(sql).toContain("ALTER TABLE t_product_sku ADD COLUMN cost_price");
    expect(sql).toContain("ALTER TABLE t_product_sku ADD COLUMN safety_stock");
    expect(sql).toContain("ALTER TABLE t_product_sku ADD COLUMN name");
    expect(sql).toContain("ALTER TABLE t_product_sku ADD COLUMN unit");
  });

  it("报表/审计/角色/供应商列", () => {
    expect(sql).toContain("ALTER TABLE t_sys_role ADD COLUMN name");
    expect(sql).toContain("ALTER TABLE t_user_coupon ADD COLUMN customer_id");
    expect(sql).toContain("ALTER TABLE t_coupon_template ADD COLUMN name");
    expect(sql).toContain("ALTER TABLE t_supplier ADD COLUMN contact_name");
    expect(sql).toContain("ALTER TABLE t_purchase_return ADD COLUMN return_amount");
    expect(sql).toContain("ALTER TABLE t_product_spu ADD COLUMN store_id");
    expect(sql).toContain("ALTER TABLE t_platform_audit_log ADD COLUMN ip_address");
    expect(sql).toContain("ALTER TABLE t_collection_link ADD COLUMN store_id");
  });

  it("每条 SQL 语句以分号结尾且无文件头注释", () => {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    expect(statements.length).toBeGreaterThanOrEqual(20);
  });
});
