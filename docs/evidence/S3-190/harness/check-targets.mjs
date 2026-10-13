/**
 * S3-190 装置④：对第 53 项的 24 个目标（18 列 + 6 索引）做**机器判定**——
 * 在指定库上查 information_schema，逐条回答两问：
 *   ① 按"缺前缀表名"（如 sys_config）查：对象在不在？（证明"缺前缀 ⇒ 恒查不到 ⇒ 语句从未生效"）
 *   ② 按"应有表名"（如 t_sys_config）查：目标列/索引在不在？定义与语料要写的是否一致？
 *
 * 用法：node docs/evidence/S3-190/harness/check-targets.mjs <库名>
 * 退出码：恒 0（这是取证工具，不代替 diff 判据）。
 */
import mysql from "mysql2/promise";

const [, , dbName] = process.argv;
if (!dbName) throw new Error("用法: check-targets.mjs <库名>");

/** 24 条目标：kind=column/index，table/name=应有表名与列/索引名，def=语料要求的定义（供人眼比对） */
const TARGETS = [
  ["column", "t_sys_config", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["column", "t_sys_user", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["column", "t_sys_role", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["column", "t_sys_permission", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["column", "t_sys_user_role", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["column", "t_sys_role_permission", "tenant_id", "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'"],
  ["index", "t_sys_config", "idx_sys_config_tenant", "(tenant_id)"],
  ["index", "t_sys_user", "idx_sys_user_tenant", "(tenant_id)"],
  ["index", "t_sys_role", "idx_sys_role_tenant", "(tenant_id)"],
  ["index", "t_sys_permission", "idx_sys_permission_tenant", "(tenant_id)"],
  ["index", "t_sys_user_role", "idx_sys_user_role_tenant", "(tenant_id)"],
  ["index", "t_sys_role_permission", "idx_sys_role_permission_tenant", "(tenant_id)"],
  ["column", "t_sale_bill_item", "unit", "VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照（瓶/箱）'"],
  ["column", "t_sale_bill_item", "barcode", "VARCHAR(128) DEFAULT NULL COMMENT '条形码快照'"],
  ["column", "t_sale_bill_item", "spec", "VARCHAR(128) DEFAULT NULL COMMENT '规格描述快照（如：500ml/瓶）'"],
  ["column", "t_sale_bill", "store_name", "VARCHAR(128) DEFAULT NULL COMMENT '门店名称快照'"],
  ["column", "t_sale_bill", "store_address", "VARCHAR(255) DEFAULT NULL COMMENT '门店地址快照'"],
  ["column", "t_sale_bill", "store_contact", "VARCHAR(64) DEFAULT NULL COMMENT '门店联系方式快照'"],
  ["column", "t_collection_link", "display_config", "JSON DEFAULT NULL COMMENT '显示字段配置'"],
  ["column", "t_collection_link", "document_title", "VARCHAR(128) DEFAULT '销售单' COMMENT '单据标题'"],
  ["column", "t_sys_user", "department_id", "BIGINT DEFAULT NULL COMMENT '所属部门ID'"],
  ["column", "t_sys_user", "position_id", "BIGINT DEFAULT NULL COMMENT '所属岗位ID'"],
  ["column", "t_purchase_order", "approval_instance_no", "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号'"],
  ["column", "t_sale_return", "approval_instance_no", "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号'"],
];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3406),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});
const q = async (sql, params) => (await conn.query(sql, params))[0];

console.log(`库 = ${dbName}`);
console.log("kind\t应有表名\t目标名\t①缺前缀表名查得行数\t②应有表名查得行数\t②实测定义/TABLE_NAME");
let missing = 0;
for (const [kind, table, name, def] of TARGETS) {
  const bare = table.replace(/^t_/, "");
  let bareCount;
  let realRows;
  if (kind === "column") {
    bareCount = (await q(
      "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
      [bare, name]
    ))[0].c;
    realRows = await q(
      "SELECT TABLE_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
      [table, name]
    );
  } else {
    bareCount = (await q(
      "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
      [bare, name]
    ))[0].c;
    realRows = await q(
      "SELECT TABLE_NAME, CONCAT('(', GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX), ')') AS COLUMN_TYPE, NULL AS IS_NULLABLE, NULL AS COLUMN_DEFAULT, NULL AS COLUMN_COMMENT FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? GROUP BY TABLE_NAME",
      [table, name]
    );
  }
  if (realRows.length === 0) missing += 1;
  const actual =
    realRows.length === 0
      ? "**不存在**"
      : `${realRows[0].TABLE_NAME} | ${realRows[0].COLUMN_TYPE} | ${realRows[0].IS_NULLABLE} | ${
          realRows[0].COLUMN_DEFAULT === null ? "NULL" : String(realRows[0].COLUMN_DEFAULT)
        } | ${realRows[0].COLUMN_COMMENT ?? ""}`;
  console.log(`${kind}\t${table}\t${name}\t${bareCount}\t${realRows.length}\t${actual}\t语料要求=${def}`);
}
console.log(`应有目标 24 条；②实查"不存在"的 = ${missing} 条`);
await conn.end();
