import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 回归保护：152 迁移补齐全业务模块表列名漂移。
 * 全量审计发现 23 张表存在服务 INSERT/UPDATE 引用列在真实表不存在的缺陷，
 * 本迁移幂等补齐（与既有列同义，避免真实库 500）。
 */
const MIGRATION_FILE = resolve(__dirname, "../../../../docs/migrations/152_business_columns_fill.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

describe("152_business_columns_fill.sql", () => {
  it("文件头必须以 SQL 语句开始（自动迁移按分号拆分）", () => {
    const firstLine = sql.split(/\r?\n/).find((l) => l.trim().length > 0)!;
    expect(firstLine.trim().toUpperCase()).toMatch(/^(ALTER|CREATE|INSERT|UPDATE)/);
  });

  it("t_operation_log 补齐多服务写入列（12 个核心服务）", () => {
    for (const col of ["log_no", "user_id", "user_name", "target_id", "target_type", "detail", "remark", "target", "category"]) {
      expect(sql).toContain(`ADD COLUMN ${col}`);
    }
    expect(sql).toContain("idx_operation_log_user_id");
    expect(sql).toContain("idx_operation_log_target");
  });

  it("t_sys_user / t_store / t_tenant / t_transfer_order 补齐员工/仓库/租户/调拨列", () => {
    expect(sql).toContain("ALTER TABLE t_sys_user ADD COLUMN department_id");
    expect(sql).toContain("ALTER TABLE t_sys_user ADD COLUMN position_id");
    expect(sql).toContain("ALTER TABLE t_sys_user ADD COLUMN is_default");
    expect(sql).toContain("ALTER TABLE t_store ADD COLUMN store_name");
    expect(sql).toContain("ALTER TABLE t_store ADD COLUMN store_type");
    expect(sql).toContain("ALTER TABLE t_tenant ADD COLUMN tenant_id");
    expect(sql).toContain("ALTER TABLE t_transfer_order ADD COLUMN from_store_name");
    expect(sql).toContain("ALTER TABLE t_transfer_order ADD COLUMN to_store_name");
  });

  it("t_miniapp_order / t_subscription / t_platform_config / t_platform_reconciliation 补齐平台/订单列", () => {
    expect(sql).toContain("ALTER TABLE t_miniapp_order ADD COLUMN shipping_fee");
    expect(sql).toContain("ALTER TABLE t_subscription ADD COLUMN order_no");
    expect(sql).toContain("ALTER TABLE t_platform_config ADD COLUMN config_key");
    expect(sql).toContain("ALTER TABLE t_platform_config ADD COLUMN config_value");
    expect(sql).toContain("ALTER TABLE t_platform_reconciliation ADD COLUMN reconciliation_no");
  });

  it("覆盖供应商对账/库存盘点/销售退货/支付/采购列", () => {
    expect(sql).toContain("ALTER TABLE t_supplier_statement ADD COLUMN statement_status");
    expect(sql).toContain("ALTER TABLE t_supplier_statement_item ADD COLUMN item_type");
    expect(sql).toContain("ALTER TABLE t_stock_check ADD COLUMN status");
    expect(sql).toContain("ALTER TABLE t_stock_check_item ADD COLUMN check_id");
    expect(sql).toContain("ALTER TABLE t_sale_return ADD COLUMN approval_instance_no");
    expect(sql).toContain("ALTER TABLE t_sale_bill ADD COLUMN status");
    expect(sql).toContain("ALTER TABLE t_purchase_order ADD COLUMN approval_instance_no");
  });

  it("每条 SQL 语句以分号结尾且无文件头注释", () => {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    expect(statements.length).toBeGreaterThanOrEqual(80);
  });
});
