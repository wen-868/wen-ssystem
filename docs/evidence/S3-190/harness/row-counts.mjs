/**
 * S3-190 装置⑤：第 55 项判据③的"行数"部分——在指定库上打印关键表行数与演示账号清单。
 *
 * 用法：node docs/evidence/S3-190/harness/row-counts.mjs <库名>
 * 退出码：恒 0（取证工具，判据在报告里逐条对照）。
 */
import mysql from "mysql2/promise";

const [, , dbName] = process.argv;
if (!dbName) throw new Error("用法: row-counts.mjs <库名>");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3406),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});
const q = async (sql) => (await conn.query(sql))[0];

console.log(`库 = ${dbName}`);
console.log("-- 关键表行数 --");
const tables = [
  "t_store",
  "t_sys_user",
  "t_product_spu",
  "t_product_sku",
  "t_supplier",
  "t_member",
  "t_sale_bill",
  "t_purchase_order",
];
console.log("表\t行数");
for (const t of tables) {
  const [exists] = await q(
    `SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}'`
  );
  if (Number(exists.c) === 0) {
    console.log(`${t}\t（表不存在）`);
    continue;
  }
  const [row] = await q(`SELECT COUNT(*) c FROM \`${t}\``);
  console.log(`${t}\t${row.c}`);
}

console.log("-- 账号（t_sys_user）--");
console.log("id\tusername\ttenant_id\tstore_id\tstatus");
const accounts = await q(
  "SELECT id, username, tenant_id, store_id, status FROM t_sys_user ORDER BY id"
);
for (const u of accounts) {
  console.log(`${u.id}\t${u.username}\t${u.tenant_id}\t${u.store_id}\t${u.status}`);
}
console.log(`账号总数 = ${accounts.length}`);
await conn.end();
