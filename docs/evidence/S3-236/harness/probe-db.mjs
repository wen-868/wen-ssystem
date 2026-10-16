#!/usr/bin/env node
/** S3-236 侦察：本机夹具库版本 / 既有四域父行现状（只读，不打印口令） */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mysql = require("mysql2/promise");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3399),
  user: process.env.DB_USER ?? "root",
  database: process.env.DB_NAME ?? "liquor_inventory",
  multipleStatements: true,
  connectTimeout: 10000,
});

try {
  const [v] = await conn.query("SELECT VERSION() AS version, DATABASE() AS db");
  console.log("version/db:", JSON.stringify(v));
  const [tenants] = await conn.query(
    "SELECT tenant_id, COUNT(*) AS n FROM t_sys_menu GROUP BY tenant_id ORDER BY tenant_id",
  );
  console.log("menu rows by tenant:", JSON.stringify(tenants));
  const [catalogs] = await conn.query(
    "SELECT tenant_id, menu_code, menu_type, parent_id FROM t_sys_menu WHERE menu_code IN ('report','store','system','dashboard','miniapp') ORDER BY tenant_id, menu_code",
  );
  console.log("candidate parent rows:", JSON.stringify(catalogs));
  const [exists] = await conn.query(
    "SELECT menu_code, COUNT(*) AS n FROM t_sys_menu WHERE menu_code LIKE 'report:%custom%' OR menu_code LIKE 'dashboard:todo%' OR menu_code LIKE 'store:hardware%' OR menu_code LIKE 'miniapp:config%' GROUP BY menu_code",
  );
  console.log("pre-existing overlap rows:", JSON.stringify(exists));
} finally {
  await conn.end();
}
