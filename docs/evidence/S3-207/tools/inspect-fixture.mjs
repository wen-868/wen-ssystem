/** 只读探针：看夹具库里 admin 的角色接线（用于给 batch-price 预览端点补夹具权限） */
import mysql from "mysql2/promise";

const DB = process.env.FIXTURE_DB || "s3207_main";
const db = await mysql.createConnection({ host: "127.0.0.1", port: 3408, user: "root", password: "", database: DB });
const q = async (sql, params = []) => (await db.query(sql, params))[0];

console.log("admin 用户：", JSON.stringify(await q("SELECT id, username, tenant_id FROM t_sys_user WHERE username = 'admin'")));
console.log(
  "角色表：",
  JSON.stringify(await q("SELECT id, role_code, tenant_id FROM t_sys_role WHERE role_code IN ('SUPER_ADMIN','STORE_MANAGER','ADMIN')"))
);
console.log("用户-角色接线：", JSON.stringify(await q("SELECT * FROM t_sys_user_role LIMIT 10")));
await db.end();
