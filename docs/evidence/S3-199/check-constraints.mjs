#!/usr/bin/env node
/**
 * S3-199 判据装置（只读）：在**真实库**上核对第 64 / 66 项定性结论对应的结构形态。
 *
 * 用法：node check-constraints.mjs [port] [db] [user] [password]
 *   默认 3408 / s3199_main / root / 空口令
 * 退出码：0 = 全部符合预期；1 = 有任一项不符合 —— 后者是反测「故意改坏 ⇒ 判红」的判据来源。
 *
 * 期望值口径：
 *   第 64 项 = 有意不设物理外键（`docs/tasks/cards/R101-S3-158-凌舟验收.md` 裁定 2）：
 *     t_tenant_admin 外键 0 条、列类型 tenant_id varchar(36) / user_id bigint unsigned。
 *   第 66 项 = 保留现状 CASCADE（引入物理删除前必须先改 RESTRICT/软删）：
 *     t_delivery_record_ibfk_1 与 fk_retail_order_item_order 的 DELETE_RULE 均为 CASCADE。
 */
import mysql from "mysql2/promise";

const [port = "3408", db = "s3199_main", user = "root", password = ""] = process.argv.slice(2);
const conn = await mysql.createConnection({
  host: "127.0.0.1",
  port: Number(port),
  user,
  password,
  database: db,
});

const rows = [];
const add = (name, expected, actual) => {
  rows.push({ name, expected, actual, ok: JSON.stringify(expected) === JSON.stringify(actual) });
};
const low = (v) => String(v ?? "").toLowerCase();

// —— 第 64 项 ——
const [fkAdmin] = await conn.query(
  `SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 't_tenant_admin'`,
  [db]
);
add("64-① t_tenant_admin 外键条数（裁定口径：不建物理外键）", 0, fkAdmin.length);

const [cols] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_tenant_admin'
      AND COLUMN_NAME IN ('tenant_id', 'user_id')`,
  [db]
);
const typeOf = (c) => low(cols.find((r) => r.COLUMN_NAME === c)?.COLUMN_TYPE);
add("64-② t_tenant_admin.tenant_id 类型", "varchar(36)", typeOf("tenant_id"));
add("64-③ t_tenant_admin.user_id 类型", "bigint unsigned", typeOf("user_id"));

const [fkTenant] = await conn.query(
  `SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = ? AND REFERENCED_TABLE_NAME = 't_tenant'
      AND TABLE_NAME NOT IN ('t_subscription', 't_tenant_module_access')`,
  [db]
);
add(
  "64-④ 除既有两张租户表外，其它指向 t_tenant 的外键数",
  0,
  fkTenant.length
);

const [[orphan]] = await conn.query(
  `SELECT COUNT(*) AS n FROM t_tenant_admin a LEFT JOIN t_tenant t ON t.id = a.tenant_id WHERE t.id IS NULL`
);
add("64-⑤ t_tenant_admin 孤儿行计数", 0, Number(orphan.n));

// —— 第 66 项 ——
const [fkRetail] = await conn.query(
  `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, r.DELETE_RULE
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.CONSTRAINT_SCHEMA = ? AND k.REFERENCED_TABLE_NAME = 't_retail_order'
    ORDER BY k.TABLE_NAME`,
  [db]
);
add(
  "66-① 指向 t_retail_order 的外键（表·约束·删除规则）",
  [
    ["t_delivery_record", "t_delivery_record_ibfk_1", "CASCADE"],
    ["t_retail_order_item", "fk_retail_order_item_order", "CASCADE"],
  ],
  fkRetail.map((r) => [r.TABLE_NAME, r.CONSTRAINT_NAME, r.DELETE_RULE])
);

const [softCols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_retail_order'
      AND COLUMN_NAME IN ('order_status', 'cancel_reason', 'cancelled_at')`,
  [db]
);
add("66-② t_retail_order 软删三列在位", 3, softCols.length);

// —— 读数留痕（不作判据） ——
const [[cmt]] = await conn.query(
  `SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_tenant_admin'`,
  [db]
);

await conn.end();

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
for (const r of rows) {
  console.log(
    `${r.ok ? "PASS" : "FAIL"} · ${pad(r.name, 52)} 期望=${JSON.stringify(r.expected)} 实际=${JSON.stringify(r.actual)}`
  );
}
console.log(`-- 读数留痕（不作判据）：t_tenant_admin 表注释 = ${JSON.stringify(cmt?.TABLE_COMMENT ?? null)}`);
const failed = rows.filter((r) => !r.ok).length;
console.log(`-- 合计 ${rows.length} 项，FAIL ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
