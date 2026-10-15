/**
 * S3-207 常驻用例：租户注入判据（收口总清单第 63 项根因）
 *
 * 锁住什么（不是一次性探针）：
 *   1. **病灶反例**：`JOIN … AND a.tenant_id = b.tenant_id`（列对列等值）**不算**"绑定到调用者租户的条件" ⇒
 *      旧判据（子串含 `tenant_id` 即跳过注入）会误判"已有租户条件"而整句跳过注入 ⇒ 跨租户聚合。
 *      本用例同时断言"旧判据会跳过、新判据不跳过"，把根因钉死。
 *   2. `tenant_id = ?`（值谓词）**算** ⇒ 不重复注入。
 *   3. 语句感知边界：`UPDATE … SET tenant_id = ?` 只是"写租户列"、不算过滤；
 *      `UPDATE/DELETE` 的谓词必须在**顶层 WHERE 之后**；`INSERT` 看列清单 / SET / SELECT 段。
 *   4. 语料一致性：`backend/scripts/fixtures/tenant-scope-corpus.json` 由本用例与
 *      `backend/scripts/guard-tenant-injection.mjs --self-test` **两侧共读** ⇒ 改判据必须同步改语料，
 *      否则两侧各红一次（防止"运行时判据"与"静态门禁"口径漂移）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TENANT_SCOPE_PLATFORM_MARKER,
  TENANT_SCOPE_SELF_MARKER,
  explainTenantInjection,
  hasCallerTenantCondition,
  hasTenantToken,
  shouldSkipTenantInjection,
  statementOf,
  tenantScopeMarkerOf,
} from "../../shared/tenant-scope";

const CORPUS_PATH = join(__dirname, "..", "..", "..", "scripts", "fixtures", "tenant-scope-corpus.json");

/** 病灶本体：finance-report 的销售成本 SQL（S3-206 扫描认定为真泄露的那一句） */
const FINANCE_JOIN_SQL = `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
  FROM t_sale_bill_item sbi
  JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
  JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
  WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
    AND DATE(sb.created_at) BETWEEN ? AND ?`;

/** 同一句的修复形态（S3-207 给调用点补的显式谓词） */
const FINANCE_JOIN_SQL_FIXED = FINANCE_JOIN_SQL.replace(
  "WHERE sb.business_status",
  "WHERE sb.tenant_id = ?\n    AND sb.business_status"
);

describe("tenant-scope 判据：病灶反例（JOIN 列对列等值）", () => {
  it("旧判据（子串含 tenant_id）确实会短路 —— 根因现场", () => {
    expect(hasTenantToken(FINANCE_JOIN_SQL)).toBe(true);
    // 旧实现就是这一句：`if (sql.toLowerCase().includes('tenant_id')) return sql;`
    expect(FINANCE_JOIN_SQL.toLowerCase().includes("tenant_id")).toBe(true);
  });

  it("新判据不再把列对列等值当成租户条件 ⇒ 不跳过注入（改后注入生效）", () => {
    expect(hasCallerTenantCondition(FINANCE_JOIN_SQL)).toBe(false);
    expect(shouldSkipTenantInjection(FINANCE_JOIN_SQL)).toBe(false);
    expect(explainTenantInjection(FINANCE_JOIN_SQL)).toBe("inject:tenant-token-without-condition");
  });

  it("调用点补上显式值谓词后 ⇒ 判为已有租户条件（不重复注入）", () => {
    expect(hasCallerTenantCondition(FINANCE_JOIN_SQL_FIXED)).toBe(true);
    expect(shouldSkipTenantInjection(FINANCE_JOIN_SQL_FIXED)).toBe(true);
    expect(explainTenantInjection(FINANCE_JOIN_SQL_FIXED)).toBe("skip:caller-tenant-condition");
  });

  it("显式标记可声明范围（self / platform），且优先于形状判定", () => {
    const platformSql = `SELECT DISTINCT tenant_id FROM t_sale_bill WHERE business_status = 'CREATED' /* ${TENANT_SCOPE_PLATFORM_MARKER} */`;
    expect(tenantScopeMarkerOf(platformSql)).toBe("platform");
    expect(shouldSkipTenantInjection(platformSql)).toBe(true);
    expect(hasCallerTenantCondition(platformSql)).toBe(false); // 形状上确实没有租户条件，靠标记放行
    const selfSql = `SELECT a.id FROM t_store a /* ${TENANT_SCOPE_SELF_MARKER} */`;
    expect(tenantScopeMarkerOf(selfSql)).toBe("self");
    expect(shouldSkipTenantInjection(selfSql)).toBe(true);
  });
});

describe("tenant-scope 判据：语句感知边界", () => {
  it("语句类型识别", () => {
    expect(statementOf("  select 1")).toBe("SELECT");
    expect(statementOf("\nUPDATE t SET x = 1")).toBe("UPDATE");
    expect(statementOf("insert into t (a) values (?)")).toBe("INSERT");
    expect(statementOf("DELETE FROM t WHERE id = ?")).toBe("DELETE");
  });

  it("UPDATE：SET tenant_id = ? 是写租户列，不算过滤", () => {
    const sql = "UPDATE t_product SET tenant_id = ?, updated_at = NOW() WHERE id = ?";
    expect(hasCallerTenantCondition(sql)).toBe(false);
  });

  it("UPDATE：谓词只有在顶层 WHERE 之后才算（子查询里的不算外层过滤）", () => {
    const setSubquery = "UPDATE t_product SET price = (SELECT price FROM t_product_price WHERE tenant_id = ?) WHERE id = ?";
    expect(hasCallerTenantCondition(setSubquery)).toBe(false);
    const whereSubquery = "UPDATE t_product SET price = ? WHERE id IN (SELECT id FROM t_price_level WHERE tenant_id = ?)";
    expect(hasCallerTenantCondition(whereSubquery)).toBe(true);
    const whereDirect = "UPDATE t_product SET price = ? WHERE tenant_id = ? AND id = ?";
    expect(hasCallerTenantCondition(whereDirect)).toBe(true);
  });

  it("DELETE：同 UPDATE 判据", () => {
    expect(hasCallerTenantCondition("DELETE FROM t_cart_item WHERE tenant_id = ? AND id = ?")).toBe(true);
    expect(hasCallerTenantCondition("DELETE FROM t_cart_item WHERE id = ?")).toBe(false);
  });

  it("INSERT：列清单 / SET / INSERT…SELECT 三种显式形态", () => {
    expect(hasCallerTenantCondition("INSERT INTO t_store (tenant_id, store_name) VALUES (?, ?)")).toBe(true);
    expect(hasCallerTenantCondition("INSERT IGNORE INTO t_customer_tag_relation (customer_id, tag_id, tenant_id) VALUES (?, ?, ?)")).toBe(true);
    expect(hasCallerTenantCondition("INSERT INTO t_miniapp_config SET tenant_id = ?, config_json = ?")).toBe(true);
    expect(hasCallerTenantCondition("INSERT INTO t_report_snapshot (store_id) SELECT id FROM t_store WHERE tenant_id = ?")).toBe(true);
    expect(hasCallerTenantCondition("INSERT INTO t_store (store_name) VALUES (?)")).toBe(false);
  });

  it("值谓词才认：不等式、列对列、字符串字面量里的字样都不认", () => {
    expect(hasCallerTenantCondition("SELECT id FROM t_sale_bill WHERE tenant_id != ?")).toBe(false);
    expect(hasCallerTenantCondition("SELECT id FROM t_store WHERE name = 'tenant_id = ?'")).toBe(false);
    expect(hasCallerTenantCondition("SELECT tenant_id, name FROM t_store WHERE status = 1")).toBe(false);
    expect(hasCallerTenantCondition("SELECT id FROM t_member WHERE tenant_id IN (?)")).toBe(true);
    expect(hasCallerTenantCondition("SELECT id FROM t_sys_user WHERE tenant_id = 'default'")).toBe(true);
  });
});

describe("tenant-scope 判据：语料一致性（与静态门禁共读同一份语料）", () => {
  const cases: Array<{ id: string; sql: string; hasCallerTenantCondition: boolean }> = JSON.parse(
    readFileSync(CORPUS_PATH, "utf8")
  );

  it("语料非空且覆盖关键反例", () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
    const ids = cases.map((c) => c.id);
    expect(ids).toContain("C02-select-junction-column-compare");
    expect(ids).toContain("C03-select-junction-with-qualified-predicate");
  });

  it.each(cases.map((c) => [c.id, c] as const))("语料 %s", (_id, c) => {
    expect(hasCallerTenantCondition(c.sql)).toBe(c.hasCallerTenantCondition);
    expect(shouldSkipTenantInjection(c.sql)).toBe(c.hasCallerTenantCondition);
  });
});
