/**
 * S3-190 装置②：验证"演示账号存在且能登录"（第 55 项判据③的后半句）。
 *
 * 走**产品自己的口令校验路径**（backend/dist/shared/password.js 的 verifyPassword +
 * backend/dist/config/constants.js 的 DEMO_PASSWORD），不是自造比较。
 *
 * 用法：
 *   node docs/evidence/S3-190/harness/verify-demo-login.mjs <库名> <工作树根>
 * 例：
 *   node docs/evidence/S3-190/harness/verify-demo-login.mjs s3190_post D:\Users\ZXQL\wt-agents\S3-190
 * 退出码：两个账号都"存在 + 口令校验通过 + status=1" ⇒ 0；否则 1。
 */
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const [, , dbName, repoArg] = process.argv;
if (!dbName || !repoArg) throw new Error("用法: verify-demo-login.mjs <库名> <工作树根>");
const repo = resolve(repoArg);

const { verifyPassword } = await import(
  pathToFileURL(join(repo, "backend", "dist", "shared", "password.js")).href
);
const { constants } = await import(
  pathToFileURL(join(repo, "backend", "dist", "config", "constants.js")).href
);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3406),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});

const accounts = ["store_manager", "store_operator"];
let allOk = true;
for (const username of accounts) {
  const [rows] = await conn.query(
    "SELECT id, username, password_hash, mobile, store_id, status, tenant_id FROM t_sys_user WHERE username = ? ORDER BY id",
    [username]
  );
  if (rows.length === 0) {
    console.log(`${username}: MISSING（t_sys_user 无此账号）`);
    allOk = false;
    continue;
  }
  const u = rows[0];
  const ok = await verifyPassword(constants.DEMO_PASSWORD, u.password_hash);
  const enabled = Number(u.status) === 1;
  console.log(
    `${username}: rows=${rows.length} id=${u.id} tenant=${u.tenant_id} store_id=${u.store_id} mobile=${u.mobile} status=${u.status}` +
      ` verifyPassword(DEMO_PASSWORD)=${ok} enabled=${enabled}`
  );
  if (!ok || !enabled) allOk = false;
}

// 第 69 项：证据/日志**不得承载口令明文**。本行的用途只是声明"校验用的是产品自己的
// constants.DEMO_PASSWORD"，值本身与判据无关 ⇒ 只留来源，不回显值。
// （判据仍由上面的 verifyPassword(DEMO_PASSWORD)=true/false 承担，未削弱。）
console.log(
  "DEMO_PASSWORD=<已脱敏：值不落证据；来源 backend/dist/config/constants.js 的 constants.DEMO_PASSWORD>"
);
console.log(allOk ? "DEMO_LOGIN_CHECK=PASS" : "DEMO_LOGIN_CHECK=FAIL");
await conn.end();
process.exit(allOk ? 0 : 1);
