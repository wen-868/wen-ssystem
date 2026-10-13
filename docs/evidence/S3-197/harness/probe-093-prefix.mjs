/**
 * S3-197 装置⑧：第①项（093 裸表名）的**语句级探针**——同一句 SQL，分别过
 * 「修复前 addTablePrefix」与「修复后 addTablePrefix」，再各下发给 MySQL 8，看真实结果。
 *
 * 用法：node docs/evidence/S3-197/harness/probe-093-prefix.mjs <修复前 dist 所在仓库根> <修复后 dist 所在仓库根> <库名>
 * 退出码：两态差异符合预期（前=ER_NO_SUCH_TABLE / 后=成功）⇒ 0；否则 1。
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const [, , beforeRepo, afterRepo, dbName] = process.argv;
if (!beforeRepo || !afterRepo || !dbName) {
  throw new Error("用法: probe-093-prefix.mjs <修复前仓库根> <修复后仓库根> <库名>");
}
const load = async (repo) =>
  import(pathToFileURL(join(repo, "backend", "dist", "shared", "migration.js")).href);
const beforeMod = await load(beforeRepo);
const afterMod = await load(afterRepo);

const stmts = [
  "CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id)",
  "CREATE INDEX idx_tenant_ibat ON inventory_batch(tenant_id)",
  "CREATE INDEX idx_tenant_il ON inventory_ledger(tenant_id)",
];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3456),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
});

let ok = true;
console.log(`库 = ${dbName}`);
console.log(`修复前 addTablePrefix 来自 = ${beforeRepo}`);
console.log(`修复后 addTablePrefix 来自 = ${afterRepo}`);
console.log("序号\t态\t下发 SQL\t执行结果");
for (const [i, stmt] of stmts.entries()) {
  for (const [tag, mod] of [["修复前", beforeMod], ["修复后", afterMod]]) {
    const prefixed = mod.addTablePrefix(stmt);
    let result;
    try {
      await conn.query(prefixed);
      result = "成功";
    } catch (e) {
      result = `${e.code || "?"}: ${String(e.message).slice(0, 80)}`;
    }
    // 期望：修复前把裸表名原样下发 ⇒ ER_NO_SUCH_TABLE；修复后补 t_ 前缀 ⇒ 成功
    const expect = tag === "修复前" ? result.startsWith("ER_NO_SUCH_TABLE") : result === "成功";
    if (!expect) ok = false;
    console.log(`${i + 1}\t${tag}\t${prefixed};\t${result}${expect ? "" : "\t** 与预期不符 **"}`);
  }
}
await conn.end();
console.log(ok ? "探针结论：两态差异与预期一致（修复前恒 ER_NO_SUCH_TABLE / 修复后成功）" : "探针结论：**与预期不符**");
process.exit(ok ? 0 : 1);
